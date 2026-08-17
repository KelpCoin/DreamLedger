from pathlib import Path
import qrcode
from qrcode.image.svg import SvgPathImage

TARGET = 'https://buy.stripe.com/28EcN54zraG13M3g3idwc1t'
OUT = Path(__file__).with_name('DreamLedger-Billboard-QR.svg')

qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=8, border=4)
qr.add_data(TARGET)
qr.make(fit=True)
qr.make_image(image_factory=SvgPathImage).save(OUT)
print('QR_GENERATED=YES')
print('QR_TARGET=' + TARGET)
print('QR_FILE=' + str(OUT))
