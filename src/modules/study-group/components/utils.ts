import { ActionSpec, ContextComponent } from "../types";

/** Collects the actionContext for an array of ContextComponents. */
export async function collectContext(components: ContextComponent[], actionSpec: ActionSpec) {
  let sb : ([Symbol, string])[]= [];
  for (let c of components) {
    const context = await c.actionContext(actionSpec);
    if (context) {
      sb.push([c.id, context]);
    }
  }
  return new Map(sb);
}