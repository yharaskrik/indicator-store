import {
  Inject,
  Injectable,
  InjectionToken,
  OnDestroy,
  Provider,
} from '@angular/core';
import {
  debounceTime,
  defer,
  finalize,
  mergeMap,
  Observable,
  of,
  Subject,
  Subscription,
  takeUntil,
  tap,
} from 'rxjs';
import {
  MatSnackBar,
  MatSnackBarConfig,
  MatSnackBarRef,
} from '@angular/material/snack-bar';
import { ComponentType } from '@angular/cdk/portal';

export interface IndicatorConfig {
  /**
   * The Component to open as the indicator.
   */
  component: ComponentType<any>;
  /**
   * How long we should keep open the snack bar once observables finish so that it is not opened/closed quickly.
   */
  keepOpen?: number;
  /**
   * Config to pass along to the openFromComponent
   */
  snackBarConfig?: MatSnackBarConfig;
}

export const INDICATOR_CONFIG = new InjectionToken<IndicatorConfig>(
  `indicator-config`
);

export function provideIndicator(config: IndicatorConfig): Provider {
  return {
    provide: IndicatorStore,
    useFactory: (matSnackBar: MatSnackBar) =>
      new IndicatorStore(matSnackBar, config),
    deps: [MatSnackBar],
  };
}

type Nextable = (v: boolean) => void;

/**
 * A custom indicate pipeable operator that allows for passing in a `Nextable` service rather than specifically a `Subject`
 * @param indicator
 */
export function indicate<ReturnObservable, Service extends { next: Nextable }>(
  indicator: Service | undefined
): (source: Observable<ReturnObservable>) => Observable<ReturnObservable> {
  return (source: Observable<ReturnObservable>) =>
    source.pipe(
      (source) =>
        defer(() => {
          indicator?.next(true);

          return source;
        }),
      finalize(() => indicator?.next(false))
    );
}

@Injectable()
export class IndicatorStore implements OnDestroy {
  /**
   * The snack bar ref that is currently open. (There will only be one open at a time)
   * @private
   */
  private matSnackBarRef?: MatSnackBarRef<any>;

  /**
   * The count of hot observables that are keeping the snackbar open
   * @private
   */
  private _count = 0;

  private readonly values$ = new Subject<boolean>();

  private readonly _subscription: Subscription;

  constructor(
    private readonly matSnackBar: MatSnackBar,
    @Inject(INDICATOR_CONFIG) private readonly config: IndicatorConfig
  ) {
    /**
     * The stream of values from all the hot observables using the `indicate` pipe. As long as there are values being pushed
     * this stream the snack bar will stay open.
     */
    this._subscription = this.values$
      .pipe(
        mergeMap((value) => {
          /*
          If the value being pushed through is `true` (ie. a new hot observable is starting) then
          increment the number of hot observables so we know there is a currently running stream being indicated.
           */
          if (value) {
            this._count += 1;

            return of(value);
          }

          /*
          If stream instead receives a false value, then decrement the count as that means the stream should no longer
          be indicated as being run. Only decrement if it's greater than 0 as a safety.
           */
          if (this._count > 0) {
            this._count -= 1;
          }

          /*
          So that really quick requests don't open and close the snackbar really quickly which is jarring ensure that it will stay open for a second.
          We do not want the snackbar to open and close very quickly as it would be jarring with auto save.
           */
          return of(value).pipe(debounceTime(this.config.keepOpen ?? 1000));
        }),
        tap(() => {
          if (this._count > 0 && !this.matSnackBarRef) {
            /*
            If the count of currently running observables is more than 0 and we do not have a snack bar open yet then open
            one and store the ref to close in the future.
             */
            this.matSnackBarRef = this.matSnackBar.openFromComponent(
              this.config.component,
              this.config.snackBarConfig
            );
          } else if (this.matSnackBarRef && this._count === 0) {
            /*
            Otherwise if there is a snack bar currently open and the count is 0 (no running streams) then we should close
            it.
             */
            this.matSnackBarRef.dismiss();
            this.matSnackBarRef = undefined;
          }
        }),
        finalize(() => {
          /*
          When this subscription is finalized (ie. the service is destroyed) then clean up the snack bar so it does
          not get stuck open.
           */
          this.matSnackBarRef?.dismiss();
        })
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this._subscription.unsubscribe();
  }

  next(value: boolean): void {
    this.values$.next(value);
  }
}

// Example usage

// @Injectable()
// export class IndicatorTest extends ComponentStore<any> {
//   constructor(private indicatorStore: IndicatorStore) {
//     super({});
//   }
//
//   e = this.effect((origin$) =>
//     origin$.pipe(
//       indicate(this.indicatorStore),
//       tap(() => {
//         // Do some stuff in the effect
//       })
//     )
//   );
// }
