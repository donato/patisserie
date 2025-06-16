import { ActionSpec, ContextComponent } from "../types";

export async function collectContext(components: ContextComponent[], actionSpec: ActionSpec) {
  let sb : ([ContextComponent, string])[]= [];
  for (let c of components) {
    const context = await c.actionContext(actionSpec);
    if (context) {
      sb.push([c, context]);
    }
  }
  return Object.fromEntries(sb);
}