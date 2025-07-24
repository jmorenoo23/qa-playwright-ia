import gradio as gr
import csv
import re
import ollama
import os
import time

# --- PROMPTS ---

TEMPLATE_PROMPT = """
A partir de la siguiente historia de usuario:

"{story}"

Genera una lista de casos de prueba manuales agrupados por tipo (Positivos, Negativos y No funcionales: Rendimiento, Accesibilidad, Usabilidad, Seguridad, Compatibilidad).

Cada caso debe tener exactamente este formato, sin omitir ninguna línea, y siempre incluir el resultado esperado:

TC001 - El usuario puede guardar preferencias correctamente  
Tipo: Positivo  
Pasos:  
1. Iniciar sesión como usuario registrado  
2. Ir a la sección "Preferencias"  
3. Activar comunicación por email  
4. Pulsar "Guardar preferencias"  
Resultado esperado: El sistema guarda los cambios y muestra una confirmación

No uses paréntesis ni pongas el tipo en el título. No expliques nada adicional.
Responde únicamente con los casos de prueba en ese formato.
"""

ANALYSIS_PROMPT = """
Analiza la siguiente historia de usuario en busca de posibles debilidades de calidad en su redacción. Evalúa los siguientes puntos:

1. ¿Está escrita con la estructura "Como... quiero... para..."? ¿Es clara y entendible para cualquier lector?
2. ¿Faltan criterios de aceptación claros y verificables?
3. ¿Hay ambigüedades funcionales o técnicas? Por ejemplo:
   - Qué ocurre si el usuario no tiene datos o configuraciones previas
   - Si hay términos que pueden interpretarse de más de una manera (ej: "preferencias", "relevante", "canales")
   - Si hay acciones o elementos mencionados sin suficiente detalle (ej: botones, estados, flujos de validación)
   - Si hay roles, permisos o excepciones que no se especifican
4. ¿Se entiende claramente qué espera el sistema y cuál es el comportamiento esperado?
5. ¿Faltan dependencias técnicas o reglas del negocio implícitas que deberían estar explicadas?

Responde en español con un análisis breve y directo. No uses formato Markdown ni pongas encabezados. Si todo está bien, indícalo. Si detectas algo a mejorar, explica claramente el problema y sugiere cómo mejorarlo.
"""

GENERATE_TEST_FROM_TC_PROMPT = """
Convierte estos casos de prueba en un archivo Playwright (TypeScript).

Reglas:
- Usa: import {{ test, expect }} from "@playwright/test";
- Un test por caso de prueba (usa test.describe() + test()).
- Usa el nombre del TC como título del test.
- Genera acciones básicas (page.goto, page.fill, page.click, page.keyboard).
- Usa asserts con expect() según el resultado esperado.
- Si faltan datos, coloca [REVISAR].
- Usa selectores accesibles (getByRole, getByLabel) siempre que sea posible.
- El código debe ser limpio, mantenible y orientado a buenas prácticas.

Responde SOLO con el código.
Genera directamente el archivo completo en formato TypeScript sin incluir ``` ni ningún formato de Markdown.
El archivo debe empezar directamente con: import {{ test, expect }} from "@playwright/test";

Ejemplo de estructura recomendada:
import {{ test, expect }} from "@playwright/test";

const BASE_URL = "https://miapp-qa.com";
const LOGIN_URL = `${{BASE_URL}}/login`;
const PERSONAL_AREA_URL = `${{BASE_URL}}/mis-datos`;

const USERS = {{
  valid: {{ email: "qa_user@miapp.com", password: "Passw0rd123" }},
  invalid: {{ email: "fake_user@miapp.com", password: "WrongPass123" }}
}};

const SELECTORS = {{
  loginLink: {{ role: "link" as const, name: /iniciar sesión/i }},
  emailField: {{ label: /email/i }},
  passwordField: {{ label: /contraseña/i }},
  submitButton: {{ role: "button" as const, name: /enviar/i }}
}};

test.describe("Login tests", () => {{
  test("TC001 - El usuario puede acceder a la página de login desde la página principal", async ({{ page }}) => {{
    await page.goto(BASE_URL);
    const loginLink = page.getByRole(SELECTORS.loginLink.role, SELECTORS.loginLink);
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(LOGIN_URL);
  }});
}});

Convierte los siguientes casos de prueba:
{test_cases}
"""

# --- FUNCIONES UTILES ---

def extract_test_cases(text):
    pattern = re.compile(
        r"(TC\d+)\s*-\s*(.*?)\nTipo:\s*(.*?)\nPasos:\n(.*?)\nResultado esperado:\s*(.+?)(?=\nTC\d+|\Z)",
        re.DOTALL
    )
    matches = pattern.findall(text)
    test_cases = []

    for tc_id, title, tc_type, steps_raw, expected in matches:
        steps = re.findall(r"\d+\.\s+(.*)", steps_raw.strip())
        for step in steps:
            test_cases.append({
                "Summary": f"{tc_id} - {title}",
                "Test Type": tc_type.strip(),
                "Step Action": step.strip(),
                "Step Expected Result": expected.strip()
            })
    return test_cases

def generate_test_cases_from_story(story):
    if not story.strip():
        return "❌ Debes introducir una historia de usuario.", "", None

    prompt = TEMPLATE_PROMPT.format(story=story.strip())
    response = ollama.chat(model="mistral", messages=[{"role": "user", "content": prompt}])
    raw_output = response['message']['content']

    test_cases = extract_test_cases(raw_output)

    if not test_cases:
        return "❌ No se pudieron extraer casos de prueba.", raw_output, None

    output_file = "test_cases_xray.csv"
    with open(output_file, "w", newline="", encoding="utf-8") as csvfile:
        fieldnames = ["Summary", "Test Type", "Step Action", "Step Expected Result"]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for case in test_cases:
            writer.writerow(case)

    return f"✅ {len(set(tc['Summary'] for tc in test_cases))} casos de prueba generados con éxito.", raw_output, output_file

def analyze_story_quality(story):
    if not story.strip():
        return "❌ Debes introducir una historia de usuario."
    prompt = ANALYSIS_PROMPT.format(story=story.strip())
    response = ollama.chat(model="mistral", messages=[{"role": "user", "content": prompt}])
    analysis = response['message']['content']

    if "todo está bien" in analysis.lower() or "todo correcto" in analysis.lower():
        status = "✅ Clara y completa"
    elif "ambigüedad" in analysis.lower() or "no se entiende" in analysis.lower():
        status = "🔴 Ambigua"
    else:
        status = "🟡 Incompleta o mejorable"

    return f"{status}\n{analysis}"

def generate_playwright_from_tcs(tcs_text, context_text):
    if not tcs_text.strip():
        return "❌ Debes introducir los casos de prueba.", None

    # Incluimos contexto adicional si se proporciona
    prompt_input = tcs_text.strip()
    if context_text.strip():
        prompt_input += "\n\nContexto adicional:\n" + context_text.strip()

    prompt = GENERATE_TEST_FROM_TC_PROMPT.format(test_cases=prompt_input)
    response = ollama.chat(model="mistral", messages=[{"role": "user", "content": prompt}])
    test_code = response['message']['content']

    # Guardar el test generado
    file_name = f"generated_from_tcs_{int(time.time())}.spec.ts"
    with open(file_name, "w", encoding="utf-8") as f:
        f.write(test_code)

    return f"✅ Test Playwright generado desde TCs: {file_name}", file_name

# --- UI Gradio ---

with gr.Blocks(title="Generador de Casos de Prueba e IA Playwright") as demo:
    gr.Markdown("## 🧪 QA Framework con IA\nGenera casos de prueba, analiza historias o crea tests automáticos en Playwright.")

    story_input = gr.Textbox(label="Historia de Usuario", lines=10, placeholder="Introduce aquí tu historia de usuario")

    with gr.Row():
        generate_btn = gr.Button("Generar Casos de Prueba (US → TCs)")
        analyze_btn = gr.Button("🔍 Analizar Historia de Usuario")

    tcs_input = gr.Textbox(label="Casos de Prueba Manuales (para automatizar)", lines=10, placeholder="Pega aquí los casos de prueba manuales generados o editados (formato texto)")

    context_input = gr.Textbox(label="Contexto adicional (URL base, datos de prueba...)", lines=4, placeholder="Ej: https://miapp.com\nUsuario válido: qa_user\nContraseña válida: Passw0rd123")

    generate_tests_btn = gr.Button("📝 Generar Tests Automáticos (TCs → Playwright)")

    output_text = gr.Textbox(label="Estado", interactive=False)
    analysis_output = gr.Textbox(label="Análisis de Calidad", interactive=False, lines=6)
    raw_output_box = gr.Textbox(label="Respuesta completa del modelo", lines=15, interactive=False, visible=True)
    csv_file = gr.File(label="Archivo CSV", visible=False)
    playwright_file = gr.File(label="Archivo Playwright", visible=False)

    # Eventos
    generate_btn.click(fn=generate_test_cases_from_story, inputs=[story_input], outputs=[output_text, raw_output_box, csv_file])
    analyze_btn.click(fn=analyze_story_quality, inputs=[story_input], outputs=[analysis_output])
    generate_tests_btn.click(fn=generate_playwright_from_tcs, inputs=[tcs_input, context_input], outputs=[output_text, playwright_file])

if __name__ == "__main__":
    demo.launch()
