import type { Tone } from '@/components/ui/tone';

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

export type Passkey = {
    id: string;
    name: string;
    last_used_at: string | null;
    created_at: string;
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

/** How a service's price reads. The server owns the wording, not the client. */
export type PricingUnit = {
    value: string;
    label: string;
    suffix: string;
    is_quoted: boolean;
};

/** A trade. `icon` is a curated Tabler name and may be null. */
export type Category = {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    services?: Service[];
};

export type Service = {
    id: string;
    name: string;
    description: string | null;
    pricing_unit: PricingUnit;
    category?: Category;
};

/** What `GET /services/{id}?address=` answers alongside the service. */
export type ServiceOffer = {
    data: Service;
    market?: { id: string; name: string } | null;
    /** The one provider auto-selected for this address, or null. */
    covering?: Listing | null;
    /** Everyone in the market who offers it. Only sent when nobody covers. */
    alternatives?: Listing[];
};

/** One provider's offer of one service. Prices are centavos. */
export type Listing = {
    id: string;
    description: string | null;
    price_min: number | null;
    price_max: number | null;
    provider: { id: string; name: string; slug: string };
    /** Only present when the query named an address. */
    surcharge?: number | null;
};

/** One photo or video, uploaded before the booking it belongs to exists. */
export type Attachment = {
    id: string;
    name: string;
    mime: string;
    size: number;
    received: number;
    is_complete: boolean;
    url: string;
};

export type BookingStatus = {
    value: string;
    label: string;
    wording: string;
    tone: Tone;
    is_open: boolean;
};

export type Booking = {
    id: string;
    status: BookingStatus;
    description: string;
    scheduled_at: string;
    cancelled_at: string | null;
    price_min: number | null;
    price_max: number | null;
    address: { label?: string; line?: string } & Record<string, unknown>;
    latitude: number | null;
    longitude: number | null;
    surcharge: number | null;
    service: { id: string; name: string; pricing_unit: PricingUnit };
    provider: { id: string; name: string };
    attachments?: Attachment[];
    created_at: string;
};

export function isTwoFactorChallenge(result: LoginResult): result is TwoFactorChallenge {
    return 'two_factor' in result && result.two_factor;
}
