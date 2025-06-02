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

  /**
   * Returns recent public events that agents can 'see' or 'hear'.
   * @returns A list of recent public event strings.
   */
  getLatestObservations(): string[] {
    // For an MVP, just return the last few public events
    return this.publicLog.slice(-5); // Adjust window as needed
  }
}