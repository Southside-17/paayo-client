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
    /** How many bookings are waiting on this person to choose somebody else. */
    bookings_needing_provider: number;
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
 */
export type Staff = {
    id: string;
    role: StaffRole;
    role_label: string;
    permissions: string[];
    /** Set once this person has asked to leave and nobody has answered. */
    resignation_requested_at: string | null;
    /** When an unanswered request goes through on its own. */
    resignation_lapses_at: string | null;
    provider: Provider;
};

/** Somebody on a business's staff, as their colleagues see them. */
export type ProviderStaff = {
    id: string;
    role: StaffRole;
    role_label: string;
    joined_at: string | null;
    resignation_requested_at: string | null;
    resignation_lapses_at: string | null;
    is_you: boolean;
    user: {
        id: string;
        nickname: string;
        email: string;
        avatar_url?: string;
    };
};

/** Somebody asked to join a staff who has not accepted yet. */
export type Invitation = {
    id: string;
    email: string;
    role: StaffRole;
    role_label: string;
    is_expired: boolean;
    expires_at: string | null;
    created_at: string | null;
};

/**
 * What a suspended account is told about its own suspension.
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

/**
 * How a provider charges for one service. The server owns the wording.
 *
 * This belongs to the listing, not the service: two providers of one service
 * may charge in completely different shapes.
 */
export type PricingMethod = {
    value: string;
    label: string;
    is_on_request: boolean;
};

/** One line of a provider's rate card. `amount` is centavos. */
export type BookedLine = RateLine & { quantity: number | null };

export type RateLine = {
    label: string;
    amount: number;
    /** What the line is charged per. Null means one price for the whole job. */
    unit: string | null;
    estimated_minutes: number | null;
    maximum_minutes: number | null;
    is_active: boolean;
};

/** A trade. `icon` is a curated Tabler name and may be null. */
export type Trade = {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    /** What this trade counts in, suggested beside a rate line's unit field. */
    units: string[];
    services?: Service[];
};

export type Service = {
    id: string;
    name: string;
    description: string | null;
    trade?: Trade;
    /**
     * The provider covering the address the list was asked for, if any.
     */
    covering?: Listing | null;
    /**
     * Everyone in the market who offers it, for when nobody covers the address.
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
    pricing_method: PricingMethod;
    rates: RateLine[];
    /** Whether the card is a menu to order from or a set of alternatives. */
    allows_many_lines: boolean;
    /** What this provider asks before taking the work. Every answer optional. */
    intake: string[];
    price_min: number | null;
    price_max: number | null;
    provider: { id: string; name: string; slug: string };
    /** Only present when the query named an address. */
    surcharge?: number | null;
};

/** Where one of a business's own offers stands, in the server's words. */
export type ListingStanding = {
    wording: string;
    tone: Tone;
    /** The sentence under the row saying why it stands there. */
    reason: string;
};

/**
 * One of a business's own offers, as the people on its staff see it. Not
 * `Listing`, which is what a client is shown of somebody else's offer.
 */
export type ProviderListing = {
    id: string;
    description: string | null;
    pricing_method: PricingMethod;
    rates: RateLine[];
    /** Whether the card is a menu to order from or a set of alternatives. */
    allows_many_lines: boolean;
    /** What this business asks a client before taking the work. */
    intake: string[];
    price_min: number | null;
    price_max: number | null;
    paused_at: string | null;
    service: Service;
    standing: ListingStanding;
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
     */
    url?: string;
};

export type BookingStatus = {
    value: string;
    label: string;
    wording: string;
    tone: Tone;
    /** Whether it can still be cancelled -- not whether anyone has answered. */
    is_open: boolean;
    /** Turned down, and waiting on the client to pick again. */
    needs_another_provider: boolean;
};

/** One status a list of bookings can be narrowed to. The server picks these. */
export type BookingFilter = {
    value: string;
    label: string;
};

/** A provider that turned a booking down. The note they gave is not sent. */
export type Decline = {
    listing_id: string;
    provider_name: string;
    declined_at: string;
};

export type Booking = {
    id: string;
    status: BookingStatus;
    description: string;
    scheduled_at: string;
    accepted_at: string | null;
    cancelled_at: string | null;
    declines: Decline[];
    price_min: number | null;
    price_max: number | null;
    /**
     * The place, as much of it as the reader is owed.
     *
     * A business waiting on an answer gets nothing finer than the barangay, so
     * every field here is optional -- see `pin_radius`.
     */
    address: {
        label?: string | null;
        line?: string | null;
        landmark?: string | null;
    } & Record<string, unknown>;
    latitude: number | null;
    longitude: number | null;
    /** Metres the real address can be from the pin. Null once the pin is exact. */
    pin_radius: number | null;
    surcharge: number | null;
    pricing_method: PricingMethod;
    /** The lines the client picked, copied off the card as it stood. */
    lines: BookedLine[];
    /** Every line summed, when all of them can be. Null for hourly work. */
    expected_total: number | null;
    intake: { question: string; answer: string | null }[];
    service: { id: string; name: string };
    provider: { id: string; name: string };
    /** Who asked. Sent only to the business the work was booked against. */
    client?: { id: string; nickname: string; phone: string | null };
    attachments?: Attachment[];
    created_at: string;
};

export function isTwoFactorChallenge(result: LoginResult): result is TwoFactorChallenge {
    return 'two_factor' in result && result.two_factor;
}

/** A trade and the services under it a business could still offer. */
export type OfferableTrade = {
    id: string;
    name: string;
    is_active: boolean;
    services: { id: string; name: string; is_active: boolean }[];
};
