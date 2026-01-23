export default function SwaggerDocsPage() {
  return (
    <div style={{ width: '100%', height: '100vh', margin: 0, padding: 0 }}>
      <iframe
        src="/docs/swagger/index.html"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          margin: 0,
          padding: 0
        }}
        title="API Documentation"
      />
    </div>
  );
}
