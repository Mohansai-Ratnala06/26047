export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Records: undefined;
  VoiceAgent: undefined;
  Consultation: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
  ClinicalResults: {
    clinicalOutput: Record<string, any>;
    conversationId?: string;
    source?: string;
  };
};

export type DoctorTabParamList = {
  Queue: undefined;
  Alerts: undefined;
  Records: undefined;
  DoctorProfile: undefined;
};

export type QueueStackParamList = {
  DoctorHome: undefined;
  PatientSummary: { patientId: string };
};
