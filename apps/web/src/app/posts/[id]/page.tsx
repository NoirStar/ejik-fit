import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LocalPostDetail } from "@/features/home-feed/local-post-detail";
import { ServerPostDetail } from "@/features/community/server-post-detail";
import { STARTER_COMMUNITY_GUIDE_ITEMS } from "@/features/home-feed/mock-community";
import { MOCK_POST_DETAILS } from "@/features/home-feed/mock-post-details";
import { PostDetailView } from "@/features/home-feed/post-detail-view";
import { isLocalCommunityPostId } from "@/lib/local-community-posts";
import { isCommunityUuid } from "@/lib/community-contract";

type PostPageProps = {
  params: Promise<{ id: string }>;
};

function postOrNotFound(id: string) {
  const post = STARTER_COMMUNITY_GUIDE_ITEMS.find((item) => item.id === id);
  const detail = MOCK_POST_DETAILS[id];

  if (!post || !detail) notFound();

  const relatedPosts = detail.relatedPostIds.flatMap((relatedId) => {
    const related = STARTER_COMMUNITY_GUIDE_ITEMS.find((item) => item.id === relatedId);
    return related ? [related] : [];
  });

  return { detail, post, relatedPosts };
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { id } = await params;
  if (isLocalCommunityPostId(id)) {
    const title = "이 기기에 남은 커뮤니티 글";
    const description =
      "작성했지만 계정에 게시되지 않아 이 기기에만 남아 있는 커뮤니티 글입니다.";
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
  const startingPostLabel = "이직핏 커뮤니티 가이드";
  const disclaimer =
    post.type === "community_post"
      ? "커뮤니티 활용을 돕기 위해 이직핏이 구성한 읽기 전용 예시입니다."
      : "커뮤니티 활용을 돕기 위해 이직핏이 구성한 읽기 전용 면접 예시이며 특정 기업의 실제 면접 기록이 아닙니다.";
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
