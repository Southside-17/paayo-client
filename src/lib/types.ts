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
    /** A signed address for the picture, present only when there is one. */
    avatar_url?: string;
    email: string;
    email_verified: boolean;
    identification_verified: boolean;
    two_factor_enabled: boolean;
    has_password: boolean;
    administrator: boolean;
    /** The sanction in force, or null. Present on every read of the account. */
    suspension: SuspensionNotice | null;
    /** Every business this account may act as. Empty for an ordinary client. */
    staffs: Staff[];
    created_at: string;
};

/** A service company, as the people on its staff see it. */
export type Provider = {
    id: string;
    name: string;
    slug: string;
    market: { id: string; name: string } | null;
    registration_verified: boolean;
    /** The sanction on the business, which is never the one on a person. */
    suspension: SuspensionNotice | null;
};

export type StaffRole = 'owner' | 'manager' | 'technician';

/**
 * One person's place on one business's staff.
 *
 * `permissions` is the role's list, sent rather than derived: what a role
 * carries is the server's to decide, and a copy of that table here would be one
 * more thing to keep in step.
 */
export type Staff = {
    id: string;
    role: StaffRole;
    role_label: string;
    permissions: string[];
    provider: Provider;
};

/**
 * What a suspended account is told about its own suspension.
 *
 * `scope` is branched on and `notice` is shown; neither can be derived from the
 * other here, so both travel. `punitive` is false for an investigation, a
 * compromised account and a legal order -- three reasons that attribute no
 * fault, and must not be worded or coloured as though they did.
 */
export type SuspensionNotice = {
    scope: 'access' | 'activity';
    notice: string;
    punitive: boolean;
    reason: string;
    starts_at: string;
    ends_at: string | null;
    appealed_at: string | null;
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
    /**
     * The provider covering the address the list was asked for, if any.
     *
     * Absent when no address was named, null when nobody covers it. Present so a
     * tap knows where it is going without a screen in between.
     */
    covering?: Listing | null;
    /**
     * Everyone in the market who offers it, for when nobody covers the address.
     *
     * Absent on a covered row and when no address was named, so its presence is
     * itself the answer to whether there is a choice to make.
     */
    alternatives?: Listing[];
};

/** What a service list and `GET /services/{id}?address=` answer around a service. */
export type ServiceOffer = {
    data: Service;
    market?: { id: string; name: string } | null;
    /** The one provider auto-selected for this address, or null. */
    covering?: Listing | null;
    /** Everyone in the market who offers it. Only sent when nobody covers. */
    alternatives?: Listing[];
};

/** What `GET /services?address=` answers around the rows. */
export type ServiceList = {
    data: Service[];
    market?: { id: string; name: string } | null;
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
    is_complete: boolean;
    /**
     * A signed address for the bytes, present once the upload is complete.
     *
     * Fetched with no headers at all: the signature is in the query string, and
     * the store reads an Authorization header in preference to it and then
     * fails to verify a bearer token it was never issued. It expires, so it is
     * read from the booking each time rather than kept.
     */
    url?: string;
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
    address: {
        label?: string | null;
        line?: string | null;
        landmark?: string | null;
    } & Record<string, unknown>;
    latitude: number | null;
    longitude: number | null;
    surcharge: number | null;
    service: { id: string; name: string; pricing_unit: PricingUnit };
    provider: { id: string; name: string };
    /** Who asked. Sent only to the business the work was booked against. */
    client?: { id: string; nickname: string; phone: string | null };
    attachments?: Attachment[];
    created_at: string;
};

export function isTwoFactorChallenge(result: LoginResult): result is TwoFactorChallenge {
    return 'two_factor' in result && result.two_factor;
}
