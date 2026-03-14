import QRCode from "qrcode";

export async function generateInvoiceQR(url: string) {
  return QRCode.toDataURL(url, {
    margin: 1,
    width: 256,
  });
}
