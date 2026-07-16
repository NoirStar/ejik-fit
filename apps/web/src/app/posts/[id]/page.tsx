import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LocalPostDetail } from "@/features/home-feed/local-post-detail";
import { MOCK_SOCIAL_ITEMS } from "@/features/home-feed/mock-community";
import { MOCK_POST_DETAILS } from "@/features/home-feed/mock-post-details";
import { PostDetailView } from "@/features/home-feed/post-detail-view";
import { isLocalCommunityPostId } from "@/lib/local-community-posts";

type PostPageProps = {
  params: Promise<{ id: string }>;
};

function postOrNotFound(id: string) {
  const post = MOCK_SOCIAL_ITEMS.find((item) => item.id === id);
  const detail = MOCK_POST_DETAILS[id];

  if (!post || !detail) notFound();

  const relatedPosts = detail.relatedPostIds.flatMap((relatedId) => {
    const related = MOCK_SOCIAL_ITEMS.find((item) => item.id === relatedId);
    return related ? [related] : [];
  });

  return { detail, post, relatedPosts };
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { id } = await params;
  if (isLocalCommunityPostId(id)) {
    const title = "이 브라우저에 저장한 커뮤니티 글";
    const description =
      "사용자가 작성해 현재 브라우저에만 저장한 커뮤니티 글입니다.";
    return {
      title,
      description,
      alternates: { canonical: `/posts/${encodeURIComponent(id)}` },
      robots: { follow: false, index: false },
    };
  }
  const { post } = postOrNotFound(id);
  const sourceDescription =
    post.type === "community_post" ? post.body : post.summary;
  const exampleLabel =
    post.type === "community_post" ? "커뮤니티 글 예시" : "면접 후기 예시";
  const disclaimer =
    post.type === "community_post"
      ? "커뮤니티 기능을 미리 살펴볼 수 있도록 만든 예시 글이며 실제 사용자가 작성한 경험이 아닙니다."
      : "커뮤니티 기능을 미리 살펴볼 수 있도록 만든 예시 면접 후기이며 특정 기업의 실제 면접 기록이 아닙니다.";
  const title = `${post.title} (${exampleLabel})`;
  const description = `${disclaimer} ${sourceDescription}`;

  return {
    title,
    description,
    alternates: { canonical: `/posts/${encodeURIComponent(id)}` },
    robots: { follow: true, index: false },
    openGraph: {
      type: "article",
      title,
      description,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  if (isLocalCommunityPostId(id)) {
    return <LocalPostDetail postId={id} />;
  }
  const { detail, post, relatedPosts } = postOrNotFound(id);

  return (
    <PostDetailView
      detail={detail}
      post={post}
      relatedPosts={relatedPosts}
    />
  );
}
