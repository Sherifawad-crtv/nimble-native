import type {
  AssistantMessage,
  AssistantReply,
  Assignment,
  AssignmentStatus,
  CoachOverview,
  Comment,
  Exercise,
  ExerciseInput,
  ExerciseProgress,
  Id,
  Invite,
  ISODate,
  LinkPreview,
  Package,
  PackageInput,
  PersonalRecord,
  ProgressSummary,
  Profile,
  Program,
  ProgramInput,
  Workout,
  WorkoutInput,
  WorkoutLog,
} from '../types';

export type ServiceErrorCode = 'not_found' | 'forbidden' | 'invalid_link' | 'unauthenticated' | 'invalid';

/** Same error shape the real backend returns. */
export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }
}

export interface ExerciseQuery {
  search?: string;
  tags?: string[];
  equipment?: string[];
}

/** Everything the UI is allowed to know about the backend. */
export interface DataService {
  // session
  getMe(): Promise<Profile>;
  /** Push notifications: remember or forget this device for the signed-in user. */
  savePushDevice(device: { endpoint: string; p256dh: string; auth: string }): Promise<void>;
  removePushDevice(endpoint: string): Promise<void>;

  /** Rule-bounded assistant for coaches: answers, or proposes one change to confirm. */
  askAssistant(messages: AssistantMessage[]): Promise<AssistantReply>;

  // library
  listExercises(q?: ExerciseQuery): Promise<Exercise[]>;
  previewVideoLink(url: string): Promise<LinkPreview>; // rejects non YouTube/Vimeo
  createExercise(input: ExerciseInput): Promise<Exercise>;
  updateExercise(id: Id, patch: Partial<Exercise>): Promise<Exercise>;
  deleteExercise(id: Id): Promise<void>;

  // workouts
  listTemplates(): Promise<Workout[]>;
  saveWorkout(w: WorkoutInput): Promise<Workout>;
  listPrograms(): Promise<Program[]>;
  saveProgram(p: ProgramInput): Promise<Program>;

  // clients and assigning
  listClients(): Promise<Profile[]>;
  /** Coach home: headline numbers and each client's place in their program. */
  getCoachOverview(): Promise<CoachOverview>;
  listInvites(): Promise<Invite[]>;
  createInvite(): Promise<Invite>;
  revokeInvite(code: string): Promise<void>;
  assignWorkout(input: { clientIds: Id[]; workoutId: Id; dates: ISODate[] }): Promise<Assignment[]>;
  assignProgram(input: { clientId: Id; programId: Id; startDate: ISODate }): Promise<Assignment[]>;
  getAssignment(id: Id): Promise<Assignment>;
  listAssignments(q: { clientId?: Id; from: ISODate; to: ISODate }): Promise<Assignment[]>;
  updateAssignment(id: Id, patch: { date?: ISODate; status?: AssignmentStatus }): Promise<Assignment>;
  deleteAssignment(id: Id): Promise<void>;

  // logging
  startWorkout(assignmentId: Id): Promise<WorkoutLog>;
  saveLog(log: WorkoutLog): Promise<WorkoutLog>;
  completeWorkout(assignmentId: Id): Promise<WorkoutLog>;
  getLog(assignmentId: Id): Promise<WorkoutLog | null>;
  listPersonalRecords(clientId: Id): Promise<PersonalRecord[]>;
  listExerciseProgress(clientId: Id): Promise<ExerciseProgress[]>;
  getProgressSummary(clientId: Id): Promise<ProgressSummary>;

  // comments
  listComments(assignmentId: Id): Promise<Comment[]>;
  addComment(assignmentId: Id, body: string): Promise<Comment>;

  // packages
  listPackages(clientId: Id): Promise<Package[]>;
  savePackage(p: PackageInput): Promise<Package>;

}

/** Sign-in for the demo backend: pick one of the seeded accounts. */
export interface DemoSession {
  readonly kind: 'demo';
  listDemoAccounts(): Promise<Profile[]>;
  signIn(profileId: Id): Promise<Profile>;
  signOut(): Promise<void>;
}

export type SignUpInput =
  | { role: 'coach'; name: string; email: string; password: string; workspaceName: string }
  | { role: 'client'; name: string; email: string; password: string; inviteCode: string };

export type AuthEvent = 'signed_in' | 'signed_out' | 'password_recovery';

/** Sign-in for the real backend: email and password accounts. */
export interface AccountSession {
  readonly kind: 'account';
  signIn(email: string, password: string): Promise<void>;
  /** Resolves 'confirm_email' when the account must be confirmed from the inbox first. */
  signUp(input: SignUpInput): Promise<'signed_in' | 'confirm_email'>;
  /** The workspace name an invite code joins, or null when the code is not valid. */
  checkInvite(code: string): Promise<string | null>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Permanently deletes the signed-in account and its data. Required by both app stores. */
  deleteAccount(): Promise<void>;
  /** An email link opened the app (confirm email, reset password): finish signing in from it. */
  handleLink(url: string): Promise<void>;
  onChange(listener: (event: AuthEvent) => void): () => void;
}

export type SessionService = DemoSession | AccountSession;
