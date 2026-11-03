export function text(value: unknown, label: string, max = 12000) {
 if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} must contain 1–${max} characters.`);
 return value.trim();
}
export function id(value:unknown) { const v=text(value,'ID',36); if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) throw new Error('Invalid ID.'); return v; }
export function stepInput(value: Record<string,unknown>) {
 const temperature=Number(value.temperature); if(!Number.isFinite(temperature)||temperature<0||temperature>2) throw new Error('Temperature must be between 0 and 2.');
 const model=text(value.model,'Model',100);if(!/^gemini-[a-z0-9.-]+$/.test(model)) throw new Error('Use a valid Gemini model name.');
 return {name:text(value.name,'Step name',100),prompt_template:text(value.prompt_template,'Prompt'),model,temperature};
}
export function renderPrompt(prompt:string,input:string,previous:string) {
 // One pass: placeholders inside model output are never interpreted as templates.
 const expanded=prompt.replace(/\{\{\s*(input|previous)\s*\}\}/g,(_,key:string)=>key==='input'?input:previous);
 return /\{\{\s*(input|previous)\s*\}\}/.test(prompt)?expanded:`${expanded}\n\nInput:\n${previous || input}`;
}
