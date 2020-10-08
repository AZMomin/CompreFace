/*
 * Copyright (c) 2020 the original author or authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { BehaviorSubject, Observable, Subscriber } from 'rxjs';
import { first } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { API_URL } from '../../data/enums/api-url.enum';
import { ROUTERS_URL } from '../../data/enums/routers-url.enum';
import { AppState } from '../../store';
import { updateUserAuthorization } from '../../store/userInfo/action';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  token$: BehaviorSubject<string>;
  refreshInProgress: boolean;
  requests = [];

  constructor(private http: HttpClient, private formBuilder: FormBuilder, private store: Store<AppState>, private router: Router) {
    this.token$ = new BehaviorSubject<string>(localStorage.getItem('token'));
  }

  getToken(): string {
    return this.token$.getValue();
  }

  getRefreshToken(): string {
    return localStorage.getItem('refreshToken');
  }

  updateTokens(token: string, refreshToken: string): void {
    this.token$.next(`Bearer ${token}`);
    localStorage.setItem('token', `Bearer ${token}`);
    localStorage.setItem('refreshToken', refreshToken);
  }

  removeToken(): void {
    this.token$.next(null);
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }

  logIn(email: string, password: string): Observable<any> {
    const url = `${environment.apiUrl}${API_URL.LOGIN}`;
    const form = this.formBuilder.group({
      email,
      password,
      grant_type: 'password'
    });
    const formData = new FormData();
    formData.append('username', form.get('email').value);
    formData.append('password', form.get('password').value);
    formData.append('grant_type', form.get('grant_type').value);
    return this.http.post(url, formData, { headers: { Authorization: environment.basicToken }, withCredentials: false });
  }

  signUp(firstName: string, password: string, email: string, lastName: string): Observable<any> {
    const url = `${environment.apiUrl}${API_URL.REGISTER}`;
    return this.http.post(url, { email, password, firstName, lastName }, {observe: 'response'});
  }

  logOut() {
    this.removeToken();
    this.store.dispatch(updateUserAuthorization({ value: false }));
    this.router.navigateByUrl(ROUTERS_URL.LOGIN);
  }

  refreshToken(req) {
    return new Observable<HttpEvent<any>>((subscriber) => {
      this.handleUnauthorizedError(subscriber, req);
    });
  }

  private handleUnauthorizedError(subscriber: Subscriber<any>, request: HttpRequest<any>) {
    this.requests.push({ subscriber, failedRequest: request });
    if (!this.refreshInProgress) {
      this.refreshInProgress = true;
      const url = `${environment.apiUrl}${API_URL.REFRESH_TOKEN}`;

      const form = this.formBuilder.group({
        grant_type: 'refresh_token',
        refresh_token: this.getRefreshToken()
      });
      const formData = new FormData();
      formData.append('grant_type', form.get('grant_type').value);
      formData.append('refresh_token', form.get('refresh_token').value);

      this.http.post(url, formData, { headers: { Authorization: environment.basicToken } })
        .pipe(
          first(),
        )
        .subscribe((authHeader: any) =>
          this.repeatFailedRequests(authHeader),
          () => {
            this.logOut();
            this.refreshInProgress = false;
          });
    }
  }

  private repeatFailedRequests(authHeader) {
    this.updateTokens(authHeader.access_token, authHeader.refresh_token);
    this.refreshInProgress = false;

    this.requests.forEach((c) => {
      this.repeatRequest(c.failedRequest, c.subscriber);
    });
    this.requests = [];
  }

  private repeatRequest(requestWithNewToken: HttpRequest<any>, subscriber: Subscriber<any>) {
    this.http.request(requestWithNewToken).subscribe((res) => {
      subscriber.next(res);
    },
      (err) => {
        if (err.status === 401) {
          this.logOut();
        }
        subscriber.error(err);
      },
      () => {
        subscriber.complete();
      });
  }

  // todo: for feature
  isTokenValid(token: string): boolean {
    return true;
  }
}
