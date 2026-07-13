import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RouteShell } from "@/components/route-shell/route-shell";
import { MOCK_SOCIAL_ITEMS } from "@/features/home-feed/mock-community";

export const metadata: Metadata = {
  title: "커뮤니티 글",
  description: "이직핏 커뮤니티 화면 구성을 보여주는 예시 콘텐츠입니다.",
};

type PostPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  const post = MOCK_SOCIAL_ITEMS.find((item) => item.id === id);

  if (!post) notFound();

  const content = post.type === "community_post" ? post.body : post.summary;

  return (
    <RouteShell
      action={<Link href="/">피드에서 다른 글 보기</Link>}
      description={content}
      eyebrow={`${post.category} · ${post.createdLabel}`}
      statusLabel="커뮤니티 예시 콘텐츠"
      title={post.title}
    >
      <p>
        <strong>{post.authorName}</strong> · {post.authorHeadline}
      </p>
      {post.type === "interview_review" && (
        <p>
          {post.companyType} · {post.role} · {post.stage}
        </p>
      )}
      <ul aria-label="글 태그">
        {post.tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
      <p>이 글과 반응 수는 홈 피드 경험을 설명하기 위해 만든 mock 데이터입니다.</p>
    </RouteShell>
  );
}
