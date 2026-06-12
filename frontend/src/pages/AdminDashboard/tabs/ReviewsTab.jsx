// ─────────────────────────────────────────────────────────────────────────────
// tabs/ReviewsTab.jsx  — Desktop: DataTable.  Mobile: tappable review cards.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from "react";
import DataTable from "../../../components/common/DataTable";
import { StarDisplay } from "../AdminShared";
import ReviewDetailModal from "../modals/ReviewDetailModal";
import { fetchVendorReviews } from "../../../services/api";
import { fmtDate } from "../adminConstants";

function MobileReviewCard({ review: r, onSelect }) {
    const color = (r.vendor_rating||0)>=4?"#059669":(r.vendor_rating||0)===3?"#D97706":"#EF4444";
    const bg    = (r.vendor_rating||0)>=4?"#D1FAE5":(r.vendor_rating||0)===3?"#FEF3C7":"#FEE2E2";
    return (
        <button className="adm-mob-card" onClick={()=>onSelect(r)} aria-label={`Review by ${r.customer_name}`}>
            <div className="adm-mob-card__head">
                <span className="adm-mob-card__primary" style={{fontWeight:700}}>{r.customer_name||"—"}</span>
                <span style={{fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:999,background:bg,color,flexShrink:0}}>
                    ★ {r.vendor_rating||0}/5
                </span>
            </div>
            {r.vehicle_display && (
                <div className="adm-mob-card__row">
                    <span className="adm-mob-card__secondary">{r.vehicle_display}</span>
                </div>
            )}
            <div className="adm-mob-card__row" style={{gap:16}}>
                <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:"var(--vm)"}}>
                    Vendor <StarDisplay value={r.vendor_rating||0} size={12}/>
                </span>
                <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:"var(--vm)"}}>
                    Vehicle <StarDisplay value={r.vehicle_rating||0} size={12}/>
                </span>
            </div>
            <div className="adm-mob-card__footer">
                <span className="adm-mob-card__meta" style={{fontStyle:r.review_text?"italic":"normal"}}>
                    {r.review_text ? `"${r.review_text.slice(0,50)}${r.review_text.length>50?"…":'"'}` : fmtDate(r.created_at)}
                </span>
                <span className="adm-mob-card__chevron">›</span>
            </div>
        </button>
    );
}

const RATING_OPTS = [
    {value:"",label:"All Ratings"},
    ...[5,4,3,2,1].map(n=>({value:String(n),label:`${n} ★`}))
];

function MobileReviewList({ reviews, onSelect }) {
    const [search,  setSearch]  = useState("");
    const [rating,  setRating]  = useState("");

    const filtered = useMemo(() => {
        let r = reviews;
        if (search.trim()) {
            const q = search.toLowerCase();
            r = r.filter(rv=>
                (rv.customer_name  ||"").toLowerCase().includes(q)||
                (rv.vehicle_display||"").toLowerCase().includes(q)||
                (rv.review_text    ||"").toLowerCase().includes(q)
            );
        }
        if (rating) r = r.filter(rv=>String(rv.vendor_rating)===rating);
        return r;
    }, [reviews, search, rating]);

    return (
        <div className="adm-mob-list">
            <div className="adm-mob-search-wrap">
                <svg className="adm-mob-search-icon" viewBox="0 0 20 20" fill="none">
                    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input className="adm-mob-search" type="search" placeholder="Search reviews…"
                    value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div className="adm-mob-pills">
                {RATING_OPTS.map(o=>(
                    <button key={o.value}
                        className={`adm-mob-pill${rating===o.value?" adm-mob-pill--active":""}`}
                        onClick={()=>setRating(o.value)}>{o.label}</button>
                ))}
            </div>
            {(search||rating) && <p className="adm-mob-count">{filtered.length} of {reviews.length} reviews</p>}
            {filtered.length===0
                ? <div className="admin-empty" style={{padding:"40px 24px"}}><span>💬</span><p>No reviews match.</p></div>
                : <div className="adm-mob-cards">{filtered.map((r,i)=><MobileReviewCard key={r.id??i} review={r} onSelect={onSelect}/>)}</div>
            }
        </div>
    );
}

const columns = [
    { key:"customer_name", label:"Customer", sortable:true, width:160,
      render:(v,row)=>(<div className="dt-cell-stack"><span className="dt-cell-stack__primary">{v||"—"}</span><span className="dt-cell-stack__secondary">{row.vehicle_display||"—"}</span></div>) },
    { key:"vendor_rating",  label:"Vendor ★",  sortable:true, width:120, render:(v)=><StarDisplay value={v||0} size={14}/> },
    { key:"vehicle_rating", label:"Vehicle ★", sortable:true, width:120, render:(v)=><StarDisplay value={v||0} size={14}/> },
    { key:"review_text", label:"Review", sortable:false,
      render:(v)=>v?<span style={{fontSize:12,color:"var(--vt2)",fontStyle:"italic",display:"block",maxWidth:280,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>"{v}"</span>:<span style={{color:"var(--vm)",fontSize:11}}>No text</span> },
    { key:"created_at", label:"Date", sortable:true, width:110, render:(v)=>fmtDate(v) },
];

export default function ReviewsTab({ reviewVendors, initialVendorId="" }) {
    const [selectedVendorId, setSelectedVendorId] = useState(initialVendorId);
    const [ordering,         setOrdering]         = useState("recency");
    const [reviews,          setReviews]          = useState([]);
    const [reviewsLoading,   setReviewsLoading]   = useState(false);
    const [selectedReview,   setSelectedReview]   = useState(null);

    const loadReviews = async (vendorId, ord) => {
        if (!vendorId) return;
        setReviewsLoading(true);
        try { const {data} = await fetchVendorReviews(vendorId,ord); setReviews(data.results??data); }
        catch { setReviews([]); }
        finally { setReviewsLoading(false); }
    };

    const handleVendorChange = async (e) => {
        const id = e.target.value; setSelectedVendorId(id); await loadReviews(id,ordering);
    };
    const handleOrderingChange = async (ord) => {
        setOrdering(ord); await loadReviews(selectedVendorId,ord);
    };

    return (
        <div className="admin-section">
            {selectedReview && <ReviewDetailModal review={selectedReview} onClose={()=>setSelectedReview(null)}/>}

            <div className="cd-filter-bar cd-filter-bar--dropdown" style={{gap:12}}>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    <label style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",color:"var(--vm)"}}>Vendor</label>
                    <select className="admin-search-input" style={{width:260,height:36,cursor:"pointer"}}
                        value={selectedVendorId} onChange={handleVendorChange}>
                        <option value="">— Select a vendor —</option>
                        {reviewVendors.map(v=>(
                            <option key={v.id} value={v.user??v.user_id}>
                                {v.business_name}{v.rating>0?` (★ ${v.rating})`:""}
                            </option>
                        ))}
                    </select>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    <label style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",color:"var(--vm)"}}>Sort</label>
                    <div style={{display:"flex",gap:6}}>
                        {[["recency","🕐 Newest"],["rating","★ Rating"]].map(([val,lbl])=>(
                            <button key={val} className={`admin-btn admin-btn--sm ${ordering===val?"admin-btn--primary":"admin-btn--ghost"}`}
                                onClick={()=>handleOrderingChange(val)}>{lbl}</button>
                        ))}
                    </div>
                </div>
            </div>

            {!selectedVendorId ? (
                <div className="admin-empty"><span>⭐</span><p>Select a vendor above to view their customer reviews.</p></div>
            ) : reviewsLoading ? (
                <div className="admin-loading"><div className="admin-loading__spinner"/>Loading reviews…</div>
            ) : (
                <>
                    <div className="adm-desktop">
                        <DataTable columns={columns} data={reviews} searchable
                            searchKeys={["customer_name","vehicle_display","review_text"]}
                            searchPlaceholder="Search reviews…"
                            filters={[{key:"vendor_rating",label:"Rating",options:RATING_OPTS}]}
                            onRowAction={row=>setSelectedReview(row)} actionLabel="View Review"
                            emptyIcon="💬" emptyMessage="No reviews for this vendor." pageSize={20}/>
                    </div>
                    <div className="adm-mobile">
                        <MobileReviewList reviews={reviews} onSelect={setSelectedReview}/>
                    </div>
                </>
            )}
        </div>
    );
}