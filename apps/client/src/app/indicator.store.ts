import {
  Inject,
  Injectable,
  InjectionToken,
  OnDestroy,
  Provider,
} from '@angular/core';
import {
  debounceTime,
  finalize,
  mergeMap,
  Observable,
  of,
  Subject,
  takeUntil,
  tap,
} from 'rxjs';
import { prepare } from 'ngx-operators';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { ComponentType } from '@angular/cdk/portal';

export interface IndicatorConfig {
  component: ComponentType<any>;
  keepOpen?: number;
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

export function indicate<ReturnObservable, Service extends { next: Nextable }>(
  indicator: Service | undefined
): (source: Observable<ReturnObservable>) => Observable<ReturnObservable> {
  return (source: Observable<ReturnObservable>) =>
    source.pipe(
      prepare(() => indicator?.next(true)),
      finalize(() => indicator?.next(false))
    );
}

@Injectable()
export class IndicatorStore<T extends ComponentType<any> = any>
  implements OnDestroy
{
  private matSnackBarRef?: MatSnackBarRef<T>;

  private _count = 0;

  private readonly values$ = new Subject<boolean>();

  private readonly _destroy$ = new Subject<void>();

  constructor(
    private readonly matSnackBar: MatSnackBar,
    @Inject(INDICATOR_CONFIG) private readonly config: IndicatorConfig
  ) {
    this.values$
      .pipe(
        takeUntil(this._destroy$),
        mergeMap((value) => {
          if (value) {
            this._count += 1;

            return of(value);
          }

          if (this._count > 0) {
            this._count -= 1;
          }

          // So that really quick requests don't open and close the snackbar really quickly which is jarring ensure that it will stay open for a second
          return of(value).pipe(debounceTime(this.config.keepOpen ?? 1000));
        }),
        tap(() => {
          if (this._count > 0 && !this.matSnackBarRef) {
            this.matSnackBarRef = this.matSnackBar.openFromComponent(
              this.config.component
            );
          } else if (this.matSnackBarRef) {
            this.matSnackBarRef.dismiss();
            this.matSnackBarRef = undefined;
          }
        }),
        finalize(() => {
          this.matSnackBarRef?.dismiss();
        })
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
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
