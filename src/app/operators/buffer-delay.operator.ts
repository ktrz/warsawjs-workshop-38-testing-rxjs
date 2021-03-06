import {
  asyncScheduler,
  BehaviorSubject,
  MonoTypeOperatorFunction,
  Observable,
  Operator,
  Subject,
  Subscriber,
  TeardownLogic,
  zip,
} from 'rxjs';
import {filter, finalize, map, takeUntil, tap} from 'rxjs/operators';
import {notNull} from './not-null.operator';

export const bufferDelay1 = (time: number) => (source: Observable<number>) => source;

export const bufferDelay =
  <T>(time: number): MonoTypeOperatorFunction<T> => (source: Observable<T>): Observable<T> => {
    return new Observable<T>(observer => {
      const scheduler = asyncScheduler;
      const ready = new BehaviorSubject<boolean>(true);
      const isReady$ = ready.asObservable().pipe(filter(v => v));
      const done$ = new Subject();

      zip(source.pipe(finalize(() => done$.next())), isReady$)
        .pipe(
          tap(() => {
            ready.next(false);
            scheduler.schedule(() => {
              ready.next(true);
            }, time);
          }),
          map(([v]) => v),
          // takeUntil(done$)
        )
        .subscribe({
          next: (x) => {
            observer.next(x);
          },
          error: (err) => {
            observer.error(err);
          },
          complete: () => {
            observer.complete();
          }
        });
    });
  };

class BufferDelayOperator<T> implements Operator<T, T> {
  constructor(private time: number) {
  }

  call(subscriber: Subscriber<T>, source: any): TeardownLogic {
    return source.subscribe(new BufferDelaySubscriber(subscriber, this.time));
  }
}

class BufferDelaySubscriber<T> extends Subscriber<T> {
  private ready = new BehaviorSubject<boolean>(true);
  private valueSubject = new BehaviorSubject<T>(null);
  private isReady$ = this.ready.asObservable().pipe(filter(v => v));
  private buffer$ = this.valueSubject.pipe(notNull);

  private completeSubject = new Subject();

  constructor(destination: Subscriber<T>, private time: number) {
    super(destination);

    zip(this.buffer$, this.isReady$)
      .pipe(
        tap(() => {
          this.ready.next(false);
          setTimeout(() => {
            this.ready.next(true);
            console.log('dam open');
          }, time);
        }),
        map(([v]) => v),
        takeUntil(this.completeSubject.asObservable()),
      )
      .subscribe({
        next: (x) => {
          this.destination.next(x);
        },
        error: (err) => {
          this.destination.error(err);
        },
        complete: () => {
          this.destination.complete();
        }
      });
  }

  protected _next(value: T): void {
    this.valueSubject.next(value);
  }

  protected _complete(): void {
    this.completeSubject.next();
  }
}
