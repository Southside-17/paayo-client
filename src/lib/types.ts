import type { Tone } from '@/components/ui/tone';

/**
 * Wire contracts. Mirrors App\Http\Resources\UserResource and the responses in
 * app/Http/Controllers/Api/V1/Auth on the server.
 */

/** Every verification plane is named in full; a bare "verified" is ambiguous. */
export type User = {
    id: string;
    /** Empty when a provider signed them up and its name was unusable. */
    nickname: string;
    fullname: string | null;
    phone: string | null;
    /** Whether the number has been proven with a texted code. */
    phone_verified: boolean;
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

/**
 * How a listing turns minutes worked into hours charged.
 *
 * A trade convention rather than a platform one, which is why it sits on the
 * listing. Snapshotted onto the booking, so changing it does not rewrite what
 * was already agreed. Rounding is always up.
 */
export type HourRounding = {
    value: 'minute' | 'half_hour' | 'hour';
    label: string;
};

/** One line of a provider's rate card. `amount` is centavos. */
export type BookedLine = RateLine & { quantity: number | null };

/**
 * One agreed line as it was actually done.
 *
 * `minutes` is what the crew stated, `chargeable_minutes` is that after the
 * booking's rounding, and `workings` is the sentence explaining the gap. The
 * rounding is applied on the server so the two ends cannot drift.
 */
export type WorkedLine = RateLine & {
    quantity: number | null;
    minutes: number | null;
    chargeable_minutes: number | null;
    workings: string | null;
    total: number | null;
};

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
    hour_rounding: HourRounding;
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
    hour_rounding: HourRounding;
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
    /**
     * Priced, and waiting on the client.
     *
     * The asymmetry the quoted route introduces: on a published price the
     * provider's yes completes the agreement, on a quoted one the client's does.
     */
    is_awaiting_client: boolean;
    /** Turned down, and waiting on the client to ask somebody else. */
    needs_another_provider: boolean;
};

/** One status a list of bookings can be narrowed to. The server picks these. */
export type BookingFilter = {
    value: string;
    label: string;
};

/** Why work is quoted rather than picked off a published card. */
export type QuotationBasis = {
    value: 'on_request' | 'beyond_ceiling';
    label: string;
    reason: string;
};

export type QuotationStatus = {
    value: string;
    label: string;
    wording: string;
    tone: Tone;
    is_awaiting_answer: boolean;
    is_agreed: boolean;
};

/**
 * A provider's priced answer to work nobody published a price for.
 *
 * `total` is null when the lines agree a *rate* rather than a figure -- an
 * hourly quote has no total until the hours are counted, and a partial sum
 * where the agreed price goes reads worse than no figure.
 */
export type Quotation = {
    id: string;
    status: QuotationStatus;
    basis: QuotationBasis;
    lines: BookedLine[];
    total: number | null;
    /** Required on a price that replaces an earlier one, and shown to the client. */
    note: string | null;
    expires_at: string;
    days_left: number;
    has_lapsed: boolean;
    is_answerable: boolean;
    replaces_id: string | null;
    answered_at: string | null;
    provider: { id: string; name: string };
    created_at: string;
};

export type EnquiryStatus = {
    value: string;
    label: string;
    wording: string;
    tone: Tone;
    is_open: boolean;
    is_awaiting_answer: boolean;
    needs_another_provider: boolean;
};

/**
 * A price asked without committing to anything.
 *
 * No `scheduled_at` and no price band, which is the whole difference from a
 * booking. An enquiry never becomes a booking -- accepting its quotation
 * writes one.
 */
export type Enquiry = {
    id: string;
    status: EnquiryStatus;
    description: string;
    intake: { question: string; answer: string | null }[];
    refused_at: string | null;
    withdrawn_at: string | null;
    address: Booking['address'];
    latitude: number | null;
    longitude: number | null;
    pin_radius: number | null;
    pricing_method: PricingMethod;
    service: { id: string; name: string };
    provider: { id: string; name: string };
    client?: { id: string; nickname: string; phone: string | null };
    quotation?: Quotation | null;
    attachments?: Attachment[];
    created_at: string;
};

/** Where the work itself stands, as distinct from the agreement. */
export type JobStatus = {
    value:
        | 'unassigned'
        | 'assigned'
        | 'enroute'
        | 'arrived'
        | 'working'
        | 'completed'
        | 'cancelled';
    label: string;
    wording: string;
    tone: Tone;
    /** The crew is out: on the way, at the address, or working. */
    is_underway: boolean;
    is_finished: boolean;
};

/** One crew member on a job, as either end reads them. */
export type JobCrew = {
    id: string;
    staff_id: string;
    nickname: string;
    is_lead: boolean;
};

/** One line of a job's history. */
export type Activity = {
    id: string;
    type: string;
    /** The sentence the timeline prints, written by the server. */
    wording: string;
    occurred_at: string;
    /** Null once the account that did it is gone. */
    by?: string | null;
};

/**
 * The work order hanging off a booking, once somebody has taken it.
 *
 * Not coarsened, and it owes no handover check: it carries no address and no
 * pin. Both ends read progress off the booking they already fetch.
 */
export type Job = {
    id: string;
    booking_id: string;
    status: JobStatus;
    enroute_at: string | null;
    arrived_at: string | null;
    /** Arriving is not starting: the wait at the gate is not billable time. */
    started_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    lines: WorkedLine[];
    /** Every line accounted for, or null while any one is not. */
    final_total: number | null;
    note: string | null;
    /** Minutes from starting to finishing, or to now. The completion pre-fill. */
    elapsed_minutes: number | null;
    /** True when nothing on the card is hourly, so there is no start tap. */
    starts_on_arrival: boolean;
    /** The one hourly line minutes may be pre-filled into, when there is one. */
    hourly_label: string | null;
    crew?: JobCrew[];
    activities?: Activity[];
    created_at: string;
};

/**
 * How a client settled an invoice.
 *
 * `cash`, `ewallet` and `bank` all mean the provider took the money and Paayo is
 * owed its share afterwards. `paymongo` means Paayo collected it. The distinction
 * is custody, not whether it was electronic -- a GCash sent straight to the
 * provider is the same shape as cash on the doorstep.
 *
 * GCash and Maya are **not** values here. They are e-wallets the way BPI and
 * Landbank are banks: the actual wallet or bank is `institution`, a field, and
 * nothing in the app behaves differently for one wallet over another.
 */
export type PaymentMethod = {
    value: 'cash' | 'ewallet' | 'bank' | 'paymongo';
    label: string;
    /** The phrase a payment line reads as, naming the institution where there is one. */
    wording: string;
};

/**
 * One account a business will take money into.
 *
 * `name` is the account name and it is not decoration: a client scanning a bare
 * QR has no way to tell whose it is. Sent only once the work has been taken --
 * a provider's GCash number is their mobile number.
 */
export type Destination = {
    method: { value: string; label: string };
    handle: string;
    name: string;
    /** The actual wallet or bank: GCash, Maya, BPI, Landbank. Always named. */
    institution: string;
    has_code: boolean;
};

/**
 * Money that arrived against an invoice.
 *
 * `is_attested` is the honest bit: a payment somebody typed in is weaker
 * evidence than one a gateway proved, and the client is shown which.
 */
export type Payment = {
    id: string;
    method: PaymentMethod;
    amount: number;
    paid_at: string;
    is_attested: boolean;
    /** Who said the money arrived. Null once that account is gone. */
    confirmed_by?: string | null;
    /** Where it was sent, snapshotted. Null for cash, which went nowhere. */
    destination: { name: string; handle: string; institution: string } | null;
    receipts?: Attachment[];
};

/**
 * What is owed on a job, raised the moment the work is finished.
 *
 * Carries no number and is nothing official yet -- a statement of what is owed,
 * which is what a business sends before the tax paperwork catches up. Settled is
 * derived from the payments, so no key here can disagree with another.
 */
export type Invoice = {
    id: string;
    lines: {
        label: string;
        amount: number;
        unit: string | null;
        quantity: number | null;
        minutes: number | null;
    }[];
    total: number;
    paid: number;
    outstanding: number;
    is_settled: boolean;
    payments?: Payment[];
    created_at: string;
};

export type Booking = {
    id: string;
    status: BookingStatus;
    description: string;
    scheduled_at: string;
    accepted_at: string | null;
    cancelled_at: string | null;
    refused_at: string | null;
    /** The figure both sides are held to, once there is an agreement. */
    agreed_total: number | null;
    quotation?: Quotation | null;
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
    /** The booking's own snapshot, never the listing's live setting. */
    hour_rounding: HourRounding;
    /** The work order, once somebody has taken the booking. */
    job?: Job | null;
    /** What is owed, once the work is finished. */
    invoice?: Invoice | null;
    /** The lines the client picked, copied off the card as it stood. */
    lines: BookedLine[];
    /** Every line summed, when all of them can be. Null for hourly work. */
    expected_total: number | null;
    intake: { question: string; answer: string | null }[];
    service: { id: string; name: string };
    provider: {
        id: string;
        name: string;
        /**
         * Where the business takes money.
         *
         * Empty until the work has been taken: a provider's GCash number is
         * their mobile number, so it is not published to anyone who merely
         * placed a booking.
         */
        destinations?: Destination[];
    };
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
