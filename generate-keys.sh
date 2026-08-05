openssl genrsa -out private.key 2048

openssl rsa -in private.key -pubout -out public.key

echo "JWT_PRIVATE_KEY=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' private.key)"
echo "JWT_PUBLIC_KEY=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' public.key)"

rm private.key public.key
