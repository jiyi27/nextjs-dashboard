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
    customerId: z.string({
        invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce
        .number()
        .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
});

// 创建新的验证模式, 去掉 id 和 date 字段
// 用于创建发票时的数据验证, 因为这两个字段是系统生成的
// 如果 CreateInvoice.parse() 时传入 id 或 date 字段会报错
const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};


export async function createInvoice(prevState: State, formData: FormData) {
    // Validate form fields using Zod
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    // Insert data into the database
    try {
        await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
    } catch (error) {
        return {
            message: 'Database Error: Failed to Create Invoice. ',
        };
    }

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
    // Note how redirect is being called outside of the try/catch block.
    // This is because redirect works by throwing an error, which would be caught by the catch block.
    // To avoid this, you can call redirect after try/catch. redirect would only be reachable if try is successful.
    // 也就是说, 只有 try 里面的语句成功后, 才会执行 redirect
    redirect('/dashboard/invoices');
}

export async function updateInvoice(id: string, formData: FormData) {
    const { customerId, amount, status } = UpdateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    const amountInCents = amount * 100;

    try {
        await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `;
    } catch (error) {
        return { message: 'Database Error: Failed to Update Invoice.' };
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
        return { message: 'Deleted Invoice.' };
    } catch (error) {
        return { message: 'Database Error: Failed to Delete Invoice.' };
    }
}