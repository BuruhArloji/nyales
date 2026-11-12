import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { getAuth, GoogleAuthProvider, signInWithCredential, signOut } from '@react-native-firebase/auth';
import type { VerifiedAccount } from './mobile-session';

/** Configure with the Firebase project's public WEB OAuth client ID. The Android
 * application package and signing SHA must also be registered in Firebase. */
export async function signInWithGoogle(webClientId: string): Promise<VerifiedAccount | null> {
  if (!webClientId.endsWith('.apps.googleusercontent.com')) throw new Error('GOOGLE_CLIENT_ID_REQUIRED');
  GoogleSignin.configure({ webClientId });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  const idToken = response.data.idToken;
  if (!idToken) throw new Error('GOOGLE_ID_TOKEN_MISSING');
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(getAuth(), credential);
  const user = result.user;
  return { subject: user.uid, getIdToken: () => user.getIdToken() };
}

export async function signOutGoogle(): Promise<void> {
  await signOut(getAuth());
  await GoogleSignin.signOut();
}
