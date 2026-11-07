// DoorDash symbol from https://about.doordash.com/en-us/company (official header).
export default function DoorDashLogo({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <span className="doordash-logo" aria-label="DoorDash">
      <svg
        role="img"
        aria-label="DoorDash logo"
        viewBox="0 0 99.5 56.5"
        width={compact ? 30 : 45}
        height={compact ? 18 : 26}
        fill="currentColor"
      >
        <path d="M95.64,13.38A25.24,25.24,0,0,0,73.27,0H2.43A2.44,2.44,0,0,0,.72,4.16L16.15,19.68a7.26,7.26,0,0,0,5.15,2.14H71.24a6.44,6.44,0,1,1,.13,12.88H36.94a2.44,2.44,0,0,0-1.72,4.16L50.66,54.39a7.25,7.25,0,0,0,5.15,2.14H71.38c20.26,0,35.58-21.66,24.26-43.16" />
      </svg>
      {!compact && <strong>DoorDash</strong>}
    </span>
  );
}
