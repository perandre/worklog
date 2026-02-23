export interface AiAdapter {
  name: string
  generateSuggestions(prompt: string, schema: object): Promise<string>
}
