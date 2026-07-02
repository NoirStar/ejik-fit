export default function Loading() {
  return (
    <main aria-busy="true" aria-label="공고를 불러오는 중">
      <div className="loading-block loading-block--intro" />
      <div className="loading-block loading-block--search" />
      <div className="loading-lines">
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}
