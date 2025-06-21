import { ConstantComponent } from "./constant-component";

const s = `
Output Format:
Respond with a JSON object containing \`action\` (string: what they are doing), \`speech\` (string: what they are saying). Either can be an empty string, but not both.

Example Output:
{
  "action": "Gestures wildly to help make her point",
  "speech": "I would NEVER say that! Who told you that rumor?",
}`;

/**
 * Provides instructions for how the LLM should generate an agents action.
 */
export class InstructionsFreeAction extends ConstantComponent {
  constructor() {
    super(s)
  }
}
