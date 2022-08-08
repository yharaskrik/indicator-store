import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideIndicator } from './indicator.store';
import { AlertComponent } from './alert/alert.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, MatSnackBarModule, BrowserAnimationsModule],
  providers: [
    provideIndicator({
      component: AlertComponent,
    }),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
