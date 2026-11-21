create or replace function public.create_guest_airtel_order(
  p_customer jsonb,
  p_items jsonb,
  p_payment_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_order_number text;
  v_reference text;
begin
  v_reference := btrim(coalesce(p_payment_reference, ''));
  if length(v_reference) < 4 or length(v_reference) > 80
     or v_reference !~ '^[A-Za-z0-9-]+$' then
    raise exception 'Référence Airtel Money invalide.';
  end if;

  -- Reuse the existing server-side validation, stock locking and order creation.
  v_result := public.create_guest_cod_order(p_customer, p_items);
  if coalesce((v_result->>'success')::boolean, false) is not true then
    raise exception 'La commande Airtel Money n’a pas pu être créée.';
  end if;

  v_order_number := v_result->>'order_number';
  update public.orders
     set payment_method = 'airtel_money',
         delivery_address = delivery_address || jsonb_build_object(
           'payment_reference', v_reference,
           'payment_recipient', '+261338203366'
         )
   where order_number = v_order_number
     and payment_method = 'cash_on_delivery'
     and payment_status = 'unpaid';

  if not found then
    raise exception 'Impossible d’enregistrer les informations Airtel Money.';
  end if;

  return v_result || jsonb_build_object(
    'payment_method', 'airtel_money',
    'payment_status', 'unpaid'
  );
end;
$function$;

revoke all on function public.create_guest_airtel_order(jsonb, jsonb, text) from public;
grant execute on function public.create_guest_airtel_order(jsonb, jsonb, text) to anon, authenticated;
