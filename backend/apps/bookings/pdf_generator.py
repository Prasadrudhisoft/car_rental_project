import io
from decimal import Decimal
from django.core.files.base import ContentFile
from django.utils import timezone
 
 
def generate_agreement_pdf(booking):
    """
    Generate rental agreement PDF and attach it to the booking record.
    Called immediately after payment is verified.
    """
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
    except ImportError:
        return  # ReportLab not installed — skip in dev if needed
 
    buf = io.BytesIO()
    c   = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
 
    # Header
    c.setFont('Helvetica-Bold', 20)
    c.setFillColorRGB(0.106, 0.227, 0.361)  # Navy colour
    c.drawCentredString(w / 2, h - 2 * cm, 'CarRent India')
    c.setFont('Helvetica', 12)
    c.setFillColorRGB(0.18, 0.46, 0.71)  # Blue
    c.drawCentredString(w / 2, h - 2.8 * cm, 'RENTAL AGREEMENT')
 
    # Booking reference
    c.setFillColorRGB(0, 0, 0)
    c.setFont('Helvetica-Bold', 11)
    c.drawString(2 * cm, h - 4 * cm, f'Booking Reference: {booking.booking_ref}')
    c.drawString(2 * cm, h - 4.7 * cm, f'Date: {booking.created_at.strftime("%d %b %Y")}')
 
    # Customer details
    c.setFont('Helvetica-Bold', 11)
    c.drawString(2 * cm, h - 6 * cm, 'CUSTOMER')
    c.setFont('Helvetica', 10)
    c.drawString(2 * cm, h - 6.7 * cm, f'Name:  {booking.customer.full_name}')
    c.drawString(2 * cm, h - 7.3 * cm, f'Email: {booking.customer.email}')
 
    # Vehicle details
    c.setFont('Helvetica-Bold', 11)
    c.drawString(2 * cm, h - 9 * cm, 'VEHICLE')
    c.setFont('Helvetica', 10)
    v = booking.vehicle
    c.drawString(2 * cm, h - 9.7 * cm,  f'Vehicle: {v.year} {v.make} {v.model}')
    c.drawString(2 * cm, h - 10.3 * cm, f'Plate:   {v.plate_number}')
    c.drawString(2 * cm, h - 10.9 * cm, f'Pickup:  {booking.pickup_date}')
    c.drawString(2 * cm, h - 11.5 * cm, f'Return:  {booking.return_date}')
 
    # Pricing
    snap = booking.pricing_snapshot
    c.setFont('Helvetica-Bold', 11)
    c.drawString(2 * cm, h - 13 * cm, 'PRICING')
    c.setFont('Helvetica', 10)
    c.drawString(2 * cm, h - 13.7 * cm, f'Base Amount:      INR {snap.get("base_amount", "0")}')
    c.drawString(2 * cm, h - 14.3 * cm, f'Add-ons:          INR {snap.get("addon_total", "0")}')
    c.drawString(2 * cm, h - 14.9 * cm, f'CGST + SGST:      INR {snap.get("gst_total", "0")}')
    c.drawString(2 * cm, h - 15.5 * cm, f'TOTAL:            INR {snap.get("grand_total", "0")}')
    c.drawString(2 * cm, h - 16.1 * cm, f'Security Deposit: INR {snap.get("security_deposit", "0")}')
 
    # Signature placeholder
    c.setFont('Helvetica', 9)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawString(2 * cm, 3 * cm, 'Customer Signature (OTP verified): _______________________')
    c.drawString(2 * cm, 2 * cm, 'Vendor Signature:                   _______________________')
 
    c.save()
    buf.seek(0)
 
    filename = f'agreement_{booking.booking_ref}.pdf'
    booking.agreement_pdf.save(filename, ContentFile(buf.read()), save=True)
 
 
def generate_invoice_pdf(booking):
    """
    Generate GST-compliant invoice PDF after return inspection.
    Creates/updates the Invoice record and attaches PDF.
    """
    from .models import Invoice
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
    except ImportError:
        return
 
    snap = booking.pricing_snapshot
    base    = Decimal(snap.get("base_amount", "0"))
    addon   = Decimal(snap.get("addon_total", "0"))
    one_way = Decimal(snap.get("one_way_fee", "0"))
    cgst    = Decimal(snap.get("cgst", "0"))
    sgst    = Decimal(snap.get("sgst", "0"))
    total   = Decimal(snap.get("grand_total", "0"))
 
    invoice_ref = f"INV-{booking.booking_ref}"
 
    buf = io.BytesIO()
    c   = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
 
    c.setFont('Helvetica-Bold', 18)
    c.setFillColorRGB(0.106, 0.227, 0.361)
    c.drawCentredString(w / 2, h - 2 * cm, 'TAX INVOICE')
    c.setFont('Helvetica-Bold', 11)
    c.drawString(2 * cm, h - 3.5 * cm, 'CarRent India')
    c.setFont('Helvetica', 10)
    c.drawString(2 * cm, h - 4.2 * cm, f'Invoice No:  {invoice_ref}')
    c.drawString(2 * cm, h - 4.8 * cm, f'Date:        {timezone.now().strftime("%d %b %Y")}')
    c.drawString(2 * cm, h - 5.4 * cm, f'Booking Ref: {booking.booking_ref}')
 
    rows = [
        ('Base Rental',           f'INR {base}'),
        ('Add-ons',                f'INR {addon}'),
        ('One-way Logistics Fee', f'INR {one_way}'),
        ('CGST (9%)',              f'INR {cgst}'),
        ('SGST (9%)',              f'INR {sgst}'),
        ('TOTAL',                  f'INR {total}'),
    ]
    y = h - 8 * cm
    for label, val in rows:
        c.setFont('Helvetica-Bold' if label == 'TOTAL' else 'Helvetica', 10)
        c.drawString(2 * cm, y, label)
        c.drawRightString(w - 2 * cm, y, val)
        y -= 0.7 * cm
 
    c.save()
    buf.seek(0)
 
    inv, _ = Invoice.objects.update_or_create(
        booking=booking,
        defaults={
            'invoice_ref':   invoice_ref,
            'base_amount':   base,
            'addon_amount':  addon,
            'one_way_fee':   one_way,
            'cgst_amount':   cgst,
            'sgst_amount':   sgst,
            'total_amount':  total,
            'deposit_status': 'released' if booking.deposit_released else 'held',
        }
    )
    inv.pdf_file.save(f'invoice_{invoice_ref}.pdf', ContentFile(buf.read()), save=True)
    return inv
