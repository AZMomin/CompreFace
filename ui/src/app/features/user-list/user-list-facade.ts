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
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { BehaviorSubject, combineLatest, Observable, Subscription } from 'rxjs';
import { map, skipWhile } from 'rxjs/operators';
import { UserService } from 'src/app/core/user/user.service';
import { AppUser } from 'src/app/data/interfaces/app-user';
import { IFacade } from 'src/app/data/interfaces/IFacade';
import { UserDeletion } from 'src/app/data/interfaces/user-deletion';
import { AppState } from 'src/app/store';
import {
  selectCurrentOrganizationId,
  selectSelectedOrganization,
  selectUserRollForSelectedOrganization,
} from 'src/app/store/organization/selectors';
import { loadRolesEntityAction } from 'src/app/store/role/actions';
import { selectAllRoles, selectIsPendingRoleStore } from 'src/app/store/role/selectors';
import { deleteUser, loadUsersEntityAction, updateUserRoleWithRefreshAction, } from 'src/app/store/user/action';
import { selectIsPendingUserStore, selectUsersWithOwnerApp } from 'src/app/store/user/selectors';
import { selectUserEmail, selectUserId } from 'src/app/store/userInfo/selectors';
import { Role } from '../../data/enums/role.enum';

@Injectable()
export class UserListFacade implements IFacade {
  selectedOrganization$: Observable<string>;
  selectedOrganizationName$: Observable<string>;
  users$: Observable<AppUser[]>;
  availableRoles$: Observable<string[]>;
  isLoading$: Observable<boolean>;
  currentUserId$: Observable<string>;
  currentUserEmail$: Observable<string>;
  userRole$: Observable<string>;
  currentUserRole: BehaviorSubject<string> = new BehaviorSubject<string>(null);

  public get currentUserRole$(): Observable<string> {
    return this.currentUserRole.asObservable().pipe(
      skipWhile((role) => !role)
    );
  }

  private selectedOrganization: string;

  private selectedOrganizationSubscription: Subscription;

  constructor(
    private store: Store<AppState>,
    private userService: UserService,
  ) {
    this.selectedOrganization$ = store.select(selectCurrentOrganizationId);
    this.selectedOrganizationName$ = store.select(selectSelectedOrganization).pipe(map(org => org.name));
    this.users$ = store.select(selectUsersWithOwnerApp);
    this.store.select(selectUserRollForSelectedOrganization).subscribe((role) => {
      this.currentUserRole.next(role);
    });

    const allRoles$ = store.select(selectAllRoles);
    this.availableRoles$ = combineLatest(allRoles$, this.currentUserRole$).pipe(
      map(([allRoles, userRole]) => {
        const roleIndex = allRoles.indexOf(userRole);
        return roleIndex !== -1 ? allRoles.slice(0, roleIndex + 1) : [];
      }),
    );

    const usersLoading$ = store.select(selectIsPendingUserStore);
    const roleLoading$ = store.select(selectIsPendingRoleStore);
    this.currentUserId$ = store.select(selectUserId);
    this.currentUserEmail$ = store.select(selectUserEmail);

    this.isLoading$ = combineLatest(usersLoading$, roleLoading$)
      .pipe(map(observResults => !(!observResults[0] && !observResults[1])));
  }

  initSubscriptions(): void {
    this.selectedOrganizationSubscription = this.selectedOrganization$.subscribe(
      orgId => {
        if (orgId) {
          this.selectedOrganization = orgId;
          this.loadUsers();
          this.loadAvailableRoles();
        }
      }
    );
  }

  loadUsers(): void {
    this.store.dispatch(loadUsersEntityAction({
      organizationId: this.selectedOrganization
    }));
  }

  updateUserRole(id: string, role: Role): void {
    this.store.dispatch(updateUserRoleWithRefreshAction({
      organizationId: this.selectedOrganization,
      user: {
        id,
        role
      }
    }));

    if (this.currentUserRole.getValue() === RoleEnum.OWNER && role === RoleEnum.OWNER) {
      this.currentUserRole.next(RoleEnum.ADMINISTRATOR);
    }
  }

  deleteUser(deletion: UserDeletion, newOwner?: string): void {
    this.store.dispatch(deleteUser({
      organizationId: this.selectedOrganization,
      userId: deletion.userToDelete.userId,
      deleterUserId: deletion.deleterUserId,
      newOwner,
    }));
  }

  loadAvailableRoles(): void {
    this.store.dispatch(loadRolesEntityAction());
  }

  unsubscribe(): void {
    this.selectedOrganizationSubscription.unsubscribe();
  }
}
