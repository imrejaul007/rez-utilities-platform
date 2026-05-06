/**
 * User entity types — based on canonical User.ts (960+ lines)
 * Includes IUser, IUserProfile, IUserAuth, IUserReferral, IUserPreferences, IUserVerifications
 */

import { UserRole, Gender, VerificationStatus, JewelryStyle, Theme, ReferralTier, RezPlusTier, PriveTier, LoyaltyTier, LocationSource, DocumentType, ProfessionType, ServiceType } from '../enums/index';

export interface IUserLocation {
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  coordinates?: [number, number]; // [longitude, latitude]
}

export interface IUserLocationHistory {
  coordinates: [number, number];
  address: string;
  city?: string;
  timestamp: Date;
  source: LocationSource;
}

export interface IUserJewelryPreferences {
  preferredMetals?: string[];
  preferredStones?: string[];
  style?: JewelryStyle;
}

export interface IUserVerificationDocument {
  documentType: string;
  documentNumber: string;
  documentImage: string;
  submittedAt: Date;
}

export interface IUserProfile {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  website?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  location?: IUserLocation;
  locationHistory?: IUserLocationHistory[];
  timezone?: string;
  ringSize?: string;
  jewelryPreferences?: IUserJewelryPreferences;
  verificationStatus?: VerificationStatus;
  verificationDocuments?: IUserVerificationDocument;
}

export interface IUserNotificationPreferences {
  push?: boolean;
  email?: boolean;
  sms?: boolean;
}

export interface IUserPreferences {
  language?: string;
  notifications?: IUserNotificationPreferences;
  categories?: string[]; // Array of category IDs
  theme?: Theme;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  smsNotifications?: boolean;
}

/**
 * @deprecated Use the Wallet collection (rez-wallet-service) instead.
 * Wallet data lives in the Wallet collection, not as a sub-doc on User.
 */
export interface IUserWallet {
  balance: number;
  isFrozen?: boolean;
}

export interface IUserAuth {
  isVerified: boolean;
  isOnboarded: boolean;
  lastLogin?: Date;
  refreshToken?: string;
  otpCode?: string;
  otpExpiry?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  totpSecret?: string;
  totpEnabled?: boolean;
  pinHash?: string;
  pinSetAt?: Date;
  pinAttempts?: number;
  pinLockedUntil?: Date;
}

export interface IUserReferral {
  referralCode: string;
  referredBy?: string;
  referredUsers: string[];
  totalReferrals: number;
  referralEarnings: number;
  referralRewardIssued?: boolean;
}

// Exclusive zone verifications
export interface IExclusiveZoneVerification {
  verified: boolean;
  verifiedAt?: Date;
}

export interface IStudentVerification extends IExclusiveZoneVerification {
  instituteName?: string;
  documentType?: DocumentType;
  expiresAt?: Date;
}

export interface ICorporateVerification extends IExclusiveZoneVerification {
  companyName?: string;
  corporateEmail?: string;
  expiresAt?: Date;
}

export interface IDefenceVerification extends IExclusiveZoneVerification {
  documentType?: DocumentType;
  serviceType?: ServiceType;
}

export interface IHealthcareVerification extends IExclusiveZoneVerification {
  documentType?: DocumentType;
  profession?: ProfessionType;
}

export interface ISeniorVerification extends IExclusiveZoneVerification {
  dateOfBirth?: Date;
}

export interface ITeacherVerification extends IExclusiveZoneVerification {
  instituteName?: string;
  documentType?: DocumentType;
}

export interface IGovernmentVerification extends IExclusiveZoneVerification {
  department?: string;
  documentType?: DocumentType;
}

export interface IDifferentlyAbledVerification extends IExclusiveZoneVerification {
  documentType?: DocumentType;
  disabilityType?: string;
}

export interface IUserVerifications {
  student?: IStudentVerification;
  corporate?: ICorporateVerification;
  defence?: IDefenceVerification;
  healthcare?: IHealthcareVerification;
  senior?: ISeniorVerification;
  teacher?: ITeacherVerification;
  government?: IGovernmentVerification;
  differentlyAbled?: IDifferentlyAbledVerification;
}

export interface IUserSocialLogin {
  googleId?: string;
  facebookId?: string;
  provider?: 'google' | 'facebook';
}

export interface IUser {
  _id?: string;
  phoneNumber: string;
  email?: string;
  password?: string;
  profile: IUserProfile;
  preferences: IUserPreferences;
  /** @deprecated Wallet data lives in the Wallet collection. Use the Wallet service instead. */
  wallet?: IUserWallet;
  auth: IUserAuth;
  referral: IUserReferral;
  verifications?: IUserVerifications;
  socialLogin?: IUserSocialLogin;
  role: UserRole;
  isActive: boolean;
  isSuspended?: boolean;
  status?: 'active' | 'suspended' | 'inactive';
  suspendedAt?: Date;
  suspendReason?: string;
  createdAt: Date;
  updatedAt: Date;

  // Convenience properties
  referralCode?: string;
  fullName?: string;
  username?: string;
  referralTier?: ReferralTier;
  isPremium?: boolean;
  premiumExpiresAt?: Date;

  // Denormalized entitlement fields
  rezPlusTier?: RezPlusTier;
  priveTier?: PriveTier;
  activeZones?: string[];
  loyaltyTier?: LoyaltyTier;

  // Additional properties
  userType?: string;
  age?: number;
  location?: string;
  interests?: string[];
  phone?: string; // Alias for phoneNumber
}
