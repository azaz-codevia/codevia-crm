import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="104" height="115" viewBox="0 0 76 84">
          <polygon fill="#B8D433" points="0,62 76,0 76,26 18,84 0,84" />
          <polygon fill="#B8D433" points="22,84 74,34 74,84 60,84 60,70 46,84" />
        </svg>
      </div>
    ),
    size,
  );
}
