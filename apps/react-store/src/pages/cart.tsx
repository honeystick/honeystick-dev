import { Link } from 'react-router-dom';

import Nav from '../components/nav';
import { imageUrl } from '../config';
import { useCart } from '../hooks/use-cart';

export default function CartPage() {
  const { cart, cartTotal, addToCart, decreaseProductQuantity, removeFromCart } =
    useCart();
  const lines = Object.values(cart);

  return (
    <div className="container">
      <Nav />
      <h2>Your cart</h2>

      {!lines.length && (
        <p className="muted">
          Your cart is empty. <Link to="/">Back to the store</Link>
        </p>
      )}

      {lines.map(({ product, quantity }) => (
        <div key={product.ext_id} className="card">
          <div className="row">
            <img
              src={imageUrl(product.image)}
              alt={product.title}
              style={{ width: 48, height: 48 }}
            />
            <div style={{ flex: 1 }}>
              <p className="title">{product.title}</p>
              <p className="muted">R{product.price.toFixed(2)} each</p>
            </div>
            <button onClick={() => decreaseProductQuantity(product)}>−</button>
            <span>{quantity}</span>
            <button onClick={() => addToCart(product)}>+</button>
            <span className="price">
              R{(product.price * quantity).toFixed(2)}
            </span>
            <button
              className="danger"
              onClick={() => removeFromCart(product.ext_id)}
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      {lines.length > 0 && (
        <div className="row">
          <span className="price">Total R{cartTotal.toFixed(2)}</span>
          <Link to="/checkout">
            <button className="primary">Checkout</button>
          </Link>
        </div>
      )}
    </div>
  );
}
