// ── Segment icons ─────────────────────────────────────────────────────────────
export const SEGMENT_ICONS = {
    hatchback: '🚗',
    sedan:     '🚘',
    suv:       '🚙',
    luxury:    '🏎️',
    van:       '🚐',
    truck:     '🚛',
};

/** Single-call helper — returns icon for a segment string */
export const segIcon = (segment) =>
    segment === 'luxury' ? '🏎️'
    : segment === 'suv'  ? '🚙'
    : segment === 'van'  ? '🚐'
    : '🚗';

// ── Fuel colours ──────────────────────────────────────────────────────────────
export const FUEL_COLOR = {
    petrol:   '#3B82F6',
    diesel:   '#E67E22',
    electric: '#10B981',
    hybrid:   '#8B5CF6',
    cng:      '#0DB89E',
};

// ── City map centres ─────────────────────────────────────────────────────────
export const CITY_CENTERS = {
    Nashik:      [20.006,  73.78],
    Mumbai:      [19.076,  72.877],
    Pune:        [18.521,  73.854],
    Nagpur:      [21.145,  79.088],
    Aurangabad:  [19.877,  75.343],
};

export const getCityCenter = (cityName) =>
    CITY_CENTERS[cityName] || [20.0, 73.78];

// ── Add-on catalogue ──────────────────────────────────────────────────────────
export const ADDON_CATALOG = [
    { key: 'insurance_basic',         icon: '🛡️', label: 'Basic Insurance',        desc: 'Third-party liability cover' },
    { key: 'insurance_comprehensive', icon: '🛡️', label: 'Comprehensive Insurance', desc: 'Full damage + theft cover' },
    { key: 'personal_accident',       icon: '🏥', label: 'Personal Accident',        desc: 'Driver & all passengers covered' },
    { key: 'child_seat',              icon: '👶', label: 'Child Seat',               desc: 'Safety-certified baby/child seat' },
    { key: 'gps',                     icon: '📡', label: 'GPS Device',               desc: 'Built-in navigation device' },
    { key: 'additional_driver',       icon: '👤', label: 'Additional Driver',        desc: 'Add a second authorised driver' },
];

// ── Nights calculator ─────────────────────────────────────────────────────────
export const calcNights = (pickupDate, returnDate) =>
    Math.max(1, Math.round(
        (new Date(returnDate) - new Date(pickupDate)) / 86400000
    ));

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
export const fixLeafletIcons = (L) => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
};

export const makePinIcon = (L, selected, emoji = '📍') =>
    new L.DivIcon({
        className:   '',
        html:        `<div class="vsp__pin${selected ? ' vsp__pin--selected' : ''}">${emoji}</div>`,
        iconSize:    [36, 36],
        iconAnchor:  [18, 36],
        popupAnchor: [0, -40],
    });

// ── Vehicle coordinate helper ─────────────────────────────────────────────────
export const getVehicleCoords = (vehicle, cityCenter, idx) => {
    const pp = vehicle.pickup_point;
    if (pp?.latitude && pp?.longitude) {
        return [parseFloat(pp.latitude), parseFloat(pp.longitude)];
    }
    if (vehicle.vendor_profile?.latitude && vehicle.vendor_profile?.longitude) {
        return [
            parseFloat(vehicle.vendor_profile.latitude),
            parseFloat(vehicle.vendor_profile.longitude),
        ];
    }
    const spread = 0.018;
    const angle  = (idx / 6) * 2 * Math.PI;
    return [
        cityCenter[0] + spread * Math.cos(angle),
        cityCenter[1] + spread * Math.sin(angle),
    ];
};

// ── Model grouping helper (kept for backwards-compat; no longer used in Step 1) ──
export function groupByModel(vehicles) {
    const map = {};
    vehicles.forEach(v => {
        const key = `${v.make}__${v.model}`;
        if (!map[key]) {
            map[key] = {
                make: v.make, model: v.model, segment: v.segment,
                fuel_types:    new Set(),
                transmissions: new Set(),
                capacity:      v.capacity,
                minRate:       parseFloat(v.daily_rate),
                maxRate:       parseFloat(v.daily_rate),
                count:         0,
                certified_count: 0,
                photos:        v.photos || [],
                vehicles:      [],
            };
        }
        const g = map[key];
        g.fuel_types.add(v.fuel_type);
        g.transmissions.add(v.transmission);
        g.minRate           = Math.min(g.minRate, parseFloat(v.daily_rate));
        g.maxRate           = Math.max(g.maxRate, parseFloat(v.daily_rate));
        g.count            += 1;
        if (v.is_certified)  g.certified_count += 1;
        if (!g.photos.length && v.photos?.length) g.photos = v.photos;
        g.vehicles.push(v);
    });
    return Object.values(map);
}