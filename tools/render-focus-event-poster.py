from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BACKGROUND = ROOT / "focus-event-poster-bg-20260829.png"
QR_CODE = ROOT / "focus-event-qr.png"
OUTPUT = ROOT / "focus-event-poster-20260829.png"
FONT_REGULAR = Path(r"C:\Windows\Fonts\NotoSansTC-VF.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\msjhbd.ttc")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size=size)


def rounded_panel(draw: ImageDraw.ImageDraw, box, radius=26, fill=(255, 255, 255, 232), outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def main() -> None:
    image = Image.open(BACKGROUND).convert("RGBA").resize((1055, 1499), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(image, "RGBA")

    green = (20, 92, 88, 255)
    teal = (25, 125, 115, 255)
    orange = (237, 111, 53, 255)
    yellow = (244, 182, 36, 255)
    ink = (36, 75, 77, 255)

    # Brand mark and name
    draw.ellipse((68, 52, 92, 76), outline=orange, width=7)
    draw.ellipse((94, 59, 108, 73), fill=yellow)
    draw.text((122, 45), "K12 覺知素養教育學苑", font=font(27, True), fill=green)

    # Title group
    rounded_panel(draw, (70, 115, 382, 173), radius=29, fill=(255, 255, 255, 220), outline=(25, 125, 115, 55), width=3)
    draw.text((94, 128), "覺知 × SEL｜6～10 歲", font=font(25, True), fill=orange)
    draw.text((70, 198), "開智班試上課程", font=font(80, True), fill=green)
    draw.text((72, 307), "陪孩子看見情緒與想法，", font=font(32, True), fill=ink)
    draw.text((72, 358), "也更清楚自己可以怎麼做。", font=font(32, True), fill=ink)

    # One strong schedule band instead of a floating form card
    draw.rounded_rectangle((58, 448, 997, 631), radius=34, fill=(237, 111, 53, 244))
    draw.rounded_rectangle((76, 466, 225, 516), radius=25, fill=(255, 255, 255, 235))
    draw.text((98, 478), "三個週六", font=font(22, True), fill=orange)
    draw.text((80, 528), "8/29　9/5　9/12", font=font(48, True), fill=(255, 255, 255, 255))
    draw.line((597, 486, 597, 594), fill=(255, 255, 255, 130), width=3)
    draw.text((640, 482), "14:00", font=font(43, True), fill=(255, 255, 255, 255))
    draw.text((640, 540), "–14:50", font=font(43, True), fill=(255, 255, 255, 255))

    # A cohesive three-part content group
    feature_specs = [
        ("看見情緒", (224, 245, 238, 235), green),
        ("專注投入", (255, 244, 205, 235), (165, 112, 8, 255)),
        ("清楚表達", (255, 229, 220, 235), (185, 75, 46, 255)),
    ]
    for index, (label, fill, text_color) in enumerate(feature_specs):
        top = 677 + index * 91
        rounded_panel(draw, (70, top, 430, top + 73), radius=22, fill=fill)
        draw.ellipse((94, top + 26, 111, top + 43), fill=text_color)
        draw.text((134, top + 16), label, font=font(28, True), fill=text_color)

    draw.text((73, 966), "從覺知開始，陪孩子一步一步前進。", font=font(24, True), fill=green)

    # Registration card anchored to the lower-left edge
    rounded_panel(draw, (70, 1075, 548, 1354), radius=30, fill=(255, 255, 255, 248), outline=teal, width=4)
    qr = Image.open(QR_CODE).convert("RGBA").resize((190, 190), Image.Resampling.NEAREST)
    image.alpha_composite(qr, (98, 1119))
    draw.text((316, 1115), "掃碼報名", font=font(33, True), fill=orange)
    draw.text((316, 1158), "開智班試上", font=font(33, True), fill=orange)
    draw.line((316, 1211, 502, 1211), fill=(25, 125, 115, 75), width=3)
    draw.text((316, 1235), "高雄市鼓山區", font=font(20, True), fill=green)
    draw.text((316, 1271), "美術東三路 86 號", font=font(20, True), fill=green)

    image.convert("RGB").save(OUTPUT, quality=95, optimize=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()
