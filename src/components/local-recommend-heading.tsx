/**
 * The heading both 和你读过的相近 blocks share. The second line is the
 * block's only claim about privacy, and it has to stay true: the marks are
 * read from localStorage and matched in the browser (`src/lib/local-recommend.ts`).
 */
export function LocalRecommendHeading() {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow user-eyebrow">本机推荐</p>
        <h2>和你读过的相近</h2>
        {/* Two runs, so a narrow screen breaks at the comma instead of
            leaving 「器。」 alone on a line (measured at 390). */}
        <p>
          <span className="nowrap-run">按你在本机的阅读记录计算，</span>
          <span className="nowrap-run">记录不离开浏览器。</span>
        </p>
      </div>
    </div>
  );
}
