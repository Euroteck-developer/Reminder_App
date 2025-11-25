import React from "react";

const Footer = () => {
  const startYear = 2025;
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="text-center"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        background: "linear-gradient(90deg, #0d6efd, #3b82f6, #60a5fa)",
        color: "#ffffff",
        padding: "12px 0",
        fontSize: "14px",
        fontWeight: 500,
        letterSpacing: "0.3px",
        borderTop: "1px solid rgba(255,255,255,0.2)",
        boxShadow: "0 -2px 8px rgba(0,0,0,0.15)",
        zIndex: 10,
      }}
    >
      &copy;{" "}
      {currentYear === startYear
        ? startYear
        : `${startYear}-${currentYear}`}{" "}
      <span style={{ fontWeight: 600 }}>Euroteck Environmental Pvt Ltd</span> | All Rights Reserved
    </footer>
  );
};

export default Footer;
