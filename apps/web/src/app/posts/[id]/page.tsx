import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MOCK_SOCIAL_ITEMS } from "@/features/home-feed/mock-community";
import { MOCK_POST_DETAILS } from "@/features/home-feed/mock-post-details";
import { PostDetailView } from "@/features/home-feed/post-detail-view";

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
  const { post } = postOrNotFound(id);
  const description =
    post.type === "community_post" ? post.body : post.summary;

  return {
    title: post.title,
    description,
    alternates: { canonical: `/posts/${encodeURIComponent(id)}` },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  const { detail, post, relatedPosts } = postOrNotFound(id);

  return (
    <PostDetailView
      detail={detail}
      post={post}
      relatedPosts={relatedPosts}
    />
  );
}
