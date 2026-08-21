/**
 * Wire contracts. Mirrors App\Http\Resources\UserResource and the responses in
 * app/Http/Controllers/Api/V1/Auth on the server.
 */

/** Both verification planes are named in full; a bare "verified" is ambiguous. */
export type User = {
    id: string;
    /** Empty when a provider signed them up and its name was unusable. */
    nickname: string;
    fullname: string | null;
    phone: string | null;
    /** Whether a picture exists; it is fetched from one fixed route. */
    avatar: boolean;
    email: string;
    email_verified: boolean;
    identification_verified: boolean;
    two_factor_enabled: boolean;
    has_password: boolean;
    administrator: boolean;
    created_at: string;
};

/** Where work should happen. Never the address printed on an ID. */
export type Address = {
    id: string;
    label: string;
    unit: string | null;
    street: string;
    subdivision: string | null;
    barangay: string;
    town: string;
    province: string;
    postal_code: string | null;
    landmark: string | null;
    latitude: number | null;
    longitude: number | null;
    is_default: boolean;
    line: string;
};

export type Social = {
    provider: string;
    label: string;
    email: string | null;
    created_at: string;
};

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export type Document = {
    id: string;
    type: string;
    type_label: string;
    issued_by: string | null;
    issued_at: string | null;
    expires_at: string | null;
    /** Which sides still have bytes behind them. */
    captures: string[];
};

export type Identification = {
    id: string;
    status: ReviewStatus;
    status_label: string;
    rejection_reason: string | null;
    reviewed_at: string | null;
    created_at: string;
    documents: Document[];
};

export type TokenResponse = {
    data: User;
    token: string;
    expires_at: string | null;
};

/** Login stops here when the account has a second factor enabled. */
export type TwoFactorChallenge = {
    two_factor: true;
    challenge_token: string;
};

export type LoginResult = TokenResponse | TwoFactorChallenge;

export type MessageResponse = {
    message: string;
};

export type QrCode = {
    svg: string;
    url: string;
    /** The base32 secret, for typing into an authenticator by hand. */
    secret_key: string;
};

export function isTwoFactorChallenge(result: LoginResult): result is TwoFactorChallenge {
    return 'two_factor' in result && result.two_factor;
}
