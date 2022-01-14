import Head from "next/head";
import grayMatter from "gray-matter";
import fetch from "node-fetch";
import parse from "parse-link-header";
import slugify from "slugify";
import { marked } from "marked";

const publishedTags = ["Published"];
let allBlogposts = [];

function parseIssue(issue) {
    const src = issue.body;
    const data = grayMatter(src);
    let title = data.data.title ?? issue.title;
    let slug;
    if (data.data.slug) {
        slug = data.data.slug;
    } else {
        slug = slugify(title);
    }
    let date = data.data.date ?? issue.created_at;

    // console.log({ ...data.data, date: new Date(data.data.date) });

    return {
        content: data.content,
        html: marked.parse(data.content),
        //data: data.data,
        title,
        slug: slug.toLowerCase(),
        date: new Date(date).toISOString(),
        ghMetadata: {
            issueUrl: issue.html_url,
            commentsUrl: issue.comments_url,
            title: issue.title,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            reactions: issue.reactions,
        },
    };
}

async function listBlogposts() {
    let allBlogposts = []; // reset to zero - make sure to handle this better when doing etags or cache restore
    let next = null;
    let limit = 0; // just a failsafe against infinite loop - feel free to remove
    const authHeader = process.env.GH_TOKEN && {
        Authorization: `token ${process.env.GH_TOKEN}`,
    };

    do {
        const res = await fetch(
            next ??
                `https://api.github.com/repos/${process.env.NEXT_PUBLIC_GH_USER_REPO}/issues?state=all&per_page=100`,
            {
                headers: authHeader,
            }
        );

        const issues = await res.json();
        if (res.status > 400)
            throw new Error(
                res.status +
                    " " +
                    res.statusText +
                    "\n" +
                    (issues && issues.message)
            );
        issues.forEach((issue) => {
            if (
                issue.labels.some((label) => publishedTags.includes(label.name))
            ) {
                allBlogposts.push(parseIssue(issue));
            }
        });
        const headers = parse(res.headers.get("Link"));
        next = headers && headers.next;
    } while (next && limit++ < 1000); // just a failsafe against infinite loop - feel free to remove
    return allBlogposts;
}

const Post = ({ post }) => {
    const { title, html = "" } = post;
    return (
        <div className="post">
            <a href="https://nextjs.org/learn">
                <h2>{title}</h2>
                <div dangerouslySetInnerHTML={{ __html: html }}></div>
            </a>

            <style jsx>{`
                .post {
                    padding: 1rem;
                    border-bottom: 1px solid #eeeeee;
                }
            `}</style>
        </div>
    );
};

export async function getServerSideProps() {
    const posts = await listBlogposts();

    console.log({ posts });

    return { props: { posts } };
}

export default function Home({ posts = [] }) {
    return (
        <div>
            <Head>
                <title>GitHub CMS</title>
                <meta
                    name="description"
                    content="Generated by create next app"
                />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className="container">
                <h1>Welcome to my blog</h1>

                {posts.map((post) => {
                    return <Post key={post.slug} post={post} />;
                })}

                <style jsx>{`
                    .container {
                        max-width: 500px;
                        margin: 2rem auto;
                    }
                `}</style>
            </main>
        </div>
    );
}
