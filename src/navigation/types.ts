import { AIModel } from '../utils/aiModels';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  ProfileSetup: { editMode?: boolean } | undefined;
  MainTabs: undefined;
  AIProfile: { model: AIModel };
  Chat: { model: AIModel };
  Notifications: undefined;
  RealProfile: { userId: string };
  UserChat: { userId: string; userName: string; userPhoto: string };
  Requests: undefined;
  Blocked: undefined;
};

export type TabParamList = {
  Home: undefined;
  Media: undefined;
  Sintonias: undefined;
  Store: undefined;
  Profile: undefined;
};