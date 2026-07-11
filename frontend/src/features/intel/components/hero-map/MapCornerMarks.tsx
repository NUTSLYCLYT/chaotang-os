export function MapCornerMarks() {
  return (
    <>
      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((position) => (
        <div
          key={position}
          className="pointer-events-none absolute h-3 w-3"
          style={{
            top: position.startsWith('top') ? 8 : undefined,
            bottom: position.startsWith('bottom') ? 8 : undefined,
            left: position.endsWith('left') ? 8 : undefined,
            right: position.endsWith('right') ? 8 : undefined,
            borderColor: '#F0C66A',
            borderWidth: '1.5px',
            borderStyle: 'solid',
            opacity: 0.7,
            borderTop: position.startsWith('bottom') ? 'none' : undefined,
            borderBottom: position.startsWith('top') ? 'none' : undefined,
            borderLeft: position.endsWith('right') ? 'none' : undefined,
            borderRight: position.endsWith('left') ? 'none' : undefined,
          }}
        />
      ))}
    </>
  );
}
