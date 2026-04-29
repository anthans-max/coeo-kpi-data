import Image from "next/image";

// Source PNG is 225×73; we render at 32px tall, width auto via style override.
// The width/height props satisfy next/image's requirement to know the natural
// aspect ratio for layout-shift prevention.
export function Logo() {
  return (
    <Image
      src="/logo.png"
      alt="COEO"
      width={225}
      height={73}
      style={{ height: 32, width: "auto" }}
      priority
    />
  );
}
