import { after, before, describe, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

const projectId = 'profu-de-mate-danmat88';
let testEnvironment;

before(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

after(async () => {
  await testEnvironment.cleanup();
});

describe('Firestore rules', () => {
  test('refuză orice acces neautentificat', async () => {
    const database = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(database, 'users/alice')));
    await assertFails(setDoc(doc(database, 'users/alice'), {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  });

  test('permite utilizatorului să-și creeze propriul profil minimal', async () => {
    const database = testEnvironment.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(database, 'users/alice'), {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      displayName: 'Ana',
      grade: 8,
      onboardingCompleted: true,
    }));
  });

  test('refuză citirea profilului altui utilizator', async () => {
    const database = testEnvironment.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(database, 'users/alice')));
  });

  test('ține configurația și evidența internă complet inaccesibile clienților', async () => {
    const database = testEnvironment.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(database, '_runtimeConfig/ai')));
    await assertFails(setDoc(doc(database, '_runtimeConfig/ai'), { enabled: false }));
    await assertFails(getDoc(doc(database, '_aiUsage/alice_2026-08-24')));
    await assertFails(getDoc(doc(database, '_analysisRequests/alice_request')));
    await assertFails(getDoc(doc(database, '_commercialUsers/alice')));
    await assertFails(getDoc(doc(database, '_commercialUsage/alice_2026-08-25')));
    await assertFails(getDoc(doc(database, '_commercialEntitlements/alice')));
    await assertFails(getDoc(doc(database, '_commercialReservations/alice_request')));
    await assertFails(getDoc(doc(database, '_commercialEvents/event-1')));
    await assertFails(getDoc(doc(database, '_accountMergeTickets/ticket-1')));
    await assertFails(getDoc(doc(database, '_pendingRevenueCatDeletions/alice')));
  });

  test('refuză crearea unei soluții direct din aplicație', async () => {
    const database = testEnvironment.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(database, 'users/alice/lessons/fake-solution'), {
      answer: '42',
      createdAt: serverTimestamp(),
    }));
  });

  test('permite doar preferințele sigure pe o lecție creată de backend', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/alice/lessons/lesson-1'), {
        answer: 'x = 4',
        mode: 'solve',
        isFavorite: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const alice = testEnvironment.authenticatedContext('alice').firestore();
    await assertSucceeds(updateDoc(doc(alice, 'users/alice/lessons/lesson-1'), {
      isFavorite: true,
      expiresAt: Timestamp.fromMillis(Date.now() + 400 * 24 * 60 * 60 * 1000),
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(alice, 'users/alice/lessons/lesson-1'), {
      expiresAt: Timestamp.fromMillis(Date.now() + 500 * 24 * 60 * 60 * 1000),
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(alice, 'users/alice/lessons/lesson-1'), {
      answer: 'x = 999',
      updatedAt: serverTimestamp(),
    }));
  });

  test('permite expirarea apropiată a unei lecții nesalvate, dar nu o dată arbitrară', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/alice/lessons/lesson-2'), {
        mode: 'solve',
        isFavorite: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const alice = testEnvironment.authenticatedContext('alice').firestore();
    await assertSucceeds(updateDoc(doc(alice, 'users/alice/lessons/lesson-2'), {
      isFavorite: false,
      expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(alice, 'users/alice/lessons/lesson-2'), {
      expiresAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
      updatedAt: serverTimestamp(),
    }));
  });

  test('feedbackul poate fi scris numai de backendul de încredere', async () => {
    const alice = testEnvironment.authenticatedContext('alice').firestore();
    const feedback = doc(alice, 'feedback/report-1');
    await assertFails(setDoc(feedback, {
      userId: 'alice',
      lessonId: 'lesson-1',
      category: 'wrong_answer',
      message: 'Ultimul pas este greșit.',
      createdAt: serverTimestamp(),
      appVersion: '1.0.0',
    }));
    await assertFails(getDoc(feedback));
  });
});
