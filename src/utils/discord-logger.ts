import { Subject, Subscription, of } from 'rxjs';
import { Client as DiscordClient, Intents, Invite, Message, TextChannel } from 'discord.js';
import { concatMap, delay} from 'rxjs/operators';


interface LogEntry {
  channel: TextChannel;
  message: string;
}

/**
 * A logger that queues incoming messages and prints them at a throttled rate,
 * ensuring no more than one message is printed per specified interval.
 */
export class DiscordLogger {
  // A Subject acts as both an Observable and an Observer.
  // We push new log messages into it using .next(), and it emits them.
  private logSubject: Subject<LogEntry>;

  // A Subscription to allow unsubscribing during clean up
  private logSubscription: Subscription | null = null;

  private intervalMs: number;

  /**
   * Creates an instance of ThrottledLogger.
   * @param intervalMs The minimum time (in milliseconds) between consecutive log prints.
   * Defaults to 1000ms (1 second).
   */
  constructor(private readonly client: DiscordClient, intervalMs: number = 1000) {
    this.intervalMs = intervalMs;
    this.logSubject = new Subject<LogEntry>();
    this.initializeLogging();
  }

  private initializeLogging(): void {
    this.logSubscription = this.logSubject.pipe(
      concatMap(entry => of(entry).pipe(delay(this.intervalMs)))
    ).subscribe({
      next: (log: LogEntry) => {
        log.channel.send(log.message);
      },
      error: (err: any) => {
        console.error(`Logging error: ${err}`);
      },
      complete: () => {
        // This callback is executed when the logSubject completes.
        // In a typical logger, the subject might not complete unless explicitly told to.
      }
    });
  }

  /**
   * Logs a message. This message will be added to the queue and emitted
   * according to the throttling interval.
   */
  log(log: LogEntry): void {
    if (log.message.trim().length ===0) { return;}
    // Push the new message into the RxJS Subject.
    this.logSubject.next(log);
  }

  /**
   * Cleans up the RxJS subscription. Call this when the logger is no longer
   * needed to prevent memory leaks.
   */
  cleanup(): void {
    if (this.logSubscription && !this.logSubscription.closed) {
      this.logSubscription.unsubscribe();
      this.logSubscription = null;
    }
  }
}