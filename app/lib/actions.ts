// By adding the 'use server', you mark all the exported functions within the file as Server Actions.
// These server functions can then be imported and used in Client and Server components.

'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// 定义完整的发票数据结构验证模式
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string(),
    amount: z.coerce.number(),
    status: z.enum(['pending', 'paid']),
    date: z.string(),
});

// 创建新的验证模式, 去掉 id 和 date 字段
// 用于创建发票时的数据验证, 因为这两个字段是系统生成的
// 如果 CreateInvoice.parse() 时传入 id 或 date 字段会报错
const CreateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
    const { customerId, amount, status } = CreateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;

    // Next.js 客户端路由缓存机制:
    // 用户先访问了手机分类页面 /phones
    // 然后点击查看某个具体手机详情页 /phones/iphone-15
    // 之后又返回到手机分类页面 /phones
    // 这时分类页面会直接从浏览器缓存中加载,不需要重新向服务器请求数据,页面瞬间显示出来

    // 用于清除和重新验证指定路径的缓存数据
    // 假设用户在发票列表页面 /dashboard/invoices 点击了创建新发票
    // 他刚刚创建了一个新发票
    // 如果不调用 revalidatePath，由于 Next.js 的缓存机制，用户可能看不到刚创建的发票
    // 调用 revalidatePath 后，Next.js 会重新获取发票列表的数据，确保显示最新状态
    revalidatePath('/dashboard/invoices');
    // 重定向到发票列表页面
    redirect('/dashboard/invoices');
}