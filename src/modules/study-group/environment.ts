import { Logger } from "./run-sim";

export class Environment {
  description: string;
  publicLog: string[]; // Stores all public actions/conversations

  constructor(description: string, readonly logger: Logger) {
    this.description = description;
    this.publicLog = [];
  }

  /**
   * Adds an event that all agents can observe.
   * @param event The event string to add.
   */
  addPublicEvent(event: string): void {
    this.publicLog.push(event);
    this.logger.log(`[Public Event] ${event}`); // For logging/debugging
  }

  getDescription() {
    return this.description;
  }

  getWorldState() {
    return `
  - Time: Mid-morning.
  - Weather: Sunny.
  - Location Context: The town square is bustling. Alice (Shopkeeper) is at her stall. Bob (Traveler) is near the well. Carol (Local) is sitting on a bench. There is one bucket near the well.
  `
  }
}