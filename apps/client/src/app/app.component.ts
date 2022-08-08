import { Component } from '@angular/core';
import { IndicatorStore } from './indicator.store';

@Component({
  selector: 'rxjs-loader-demo-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  constructor(private indicatorStore: IndicatorStore) {
    setInterval(() => {
      console.log('Interval');
      this.indicatorStore.next(Math.random() < 0.5 ? true : false);
    }, 1500);
  }
}
