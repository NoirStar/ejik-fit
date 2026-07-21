import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LocalPostDetail } from "@/features/home-feed/local-post-detail";
import { ServerPostDetail } from "@/features/community/server-post-detail";
import { MOCK_SOCIAL_ITEMS } from "@/features/home-feed/mock-community";
import { MOCK_POST_DETAILS } from "@/features/home-feed/mock-post-details";
import { PostDetailView } from "@/features/home-feed/post-detail-view";
import { isLocalCommunityPostId } from "@/lib/local-community-posts";
import { isCommunityUuid } from "@/lib/community-contract";

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
  if (isCommunityUuid(id)) {
    const title = "이직핏 커뮤니티 글";
    const description = "이직핏 사용자가 계정에 작성한 공개 커뮤니티 글입니다.";
    return {
      title,
      description,
      alternates: { canonical: `/posts/${encodeURIComponent(id)}` },
      robots: { follow: true, index: false },
    };
  }
  const { post } = postOrNotFound(id);
  const sourceDescription =
    post.type === "community_post" ? post.body : post.summary;
  const startingPostLabel = "이직핏 시작 글";
  const disclaimer =
    post.type === "community_post"
      ? "커뮤니티 탐색을 돕기 위해 이직핏이 구성한 시작 글입니다."
      : "커뮤니티 탐색을 돕기 위해 이직핏이 구성한 면접 이야기이며 특정 기업의 실제 면접 기록이 아닙니다.";
  const title = `${post.title} (${startingPostLabel})`;
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
  if (isCommunityUuid(id)) {
    return <ServerPostDetail postId={id} />;
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
